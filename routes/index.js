var express = require('express');
var router = express.Router();
var request = require('request');
const fs = require('fs');
const Point = require("../models/point");
let path = require("path")
let axios = require("axios")
const PointsForOneGarage=20;

// Ход шага для случайных точек на КАРТЕ
const deltaX = 0.01;
const deltaY = 0.005;

let count = 144;
count = Math.sqrt(count);

const Center = [39.557099, 52.605997]
const [x, y] = Center;

const Garages = [
    new Point(39.53994646, 52.6389125),
    new Point(39.52249936, 52.6055795),
]

function StrToPoint(strPoint) {
    let dateRegexp = /lat=(?<lat>[0-9]+\.[0-9]+)&lon=(?<lon>[0-9]+\.[0-9]+)/;
    let groups = strPoint.match(dateRegexp).groups;
    return new Point(+groups.lat, +groups.lon)
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function calcSnowStatistics(json) {
    let res = {}
    let fact = json["fact"];
    let parts = json["forecasts"];
    res['fact'] = {
        prec_type: fact["prec_type"],
        prec_strength: fact["prec_strength"]
    }
    for (let record of parts) {
        let parts = record["parts"];
        res[record["date"]] = {
            parts: {
                night: {
                    ["prec_mm"]: parts["night"]["prec_mm"] + Math.random()*20 %20,
                    ["prec_period"]: parts["night"]["prec_period"],
                    ["prec_type"]: parts["night"]["prec_type"],
                    ["prec_strength"]: 0.5+parts["night"]["prec_strength"],
                },
                evening: {
                    ["prec_mm"]: parts["night"]["prec_mm"],
                    ["prec_period"]: parts["night"]["prec_period"],
                    ["prec_type"]: parts["night"]["prec_type"],
                    ["prec_strength"]: 0.5+parts["night"]["prec_strength"],
                },
                day_short: {
                    ["prec_mm"]: parts["day_short"]["prec_mm"] + Math.random()*20 %20,
                    ["prec_period"]: parts["day_short"]["prec_period"],
                    ["prec_type"]: parts["day_short"]["prec_type"],
                    ["prec_strength"]: 0.5+parts["day_short"]["prec_strength"],
                },
                morning: {
                    ["prec_mm"]: parts["morning"]["prec_mm"],
                    ["prec_period"]: parts["morning"]["prec_period"],
                    ["prec_type"]: parts["morning"]["prec_type"],
                    ["prec_strength"]: 0.5+parts["morning"]["prec_strength"],
                },
                night_short: {
                    ["prec_mm"]: parts["night_short"]["prec_mm"],
                    ["prec_period"]: parts["night_short"]["prec_period"],
                    ["prec_type"]: parts["night_short"]["prec_type"],
                    ["prec_strength"]: 0.5+parts["night_short"]["prec_strength"],
                },

            }
        }
    }

    res["forecast"] = json["forecast"]
    return res;
}

function ExistsFile(filename = 'weather') {
    let filePath = path.join(__dirname, `/../${filename}.json`);
    return fs.existsSync(filePath)
}

async function ReadFile(filename = 'weather') {
    let res = {}
    let filePath = path.join(__dirname, `/../${filename}.json`);
    if (!ExistsFile(filename)) {
        let json = JSON.stringify({});
        console.error("Нет файла!")
        await fs.writeFile(filePath, json, {}, (err) => {
            if (err) console.log('error!')
        });
    } else {
        let data = fs.readFileSync(filePath, 'utf8');
        res = JSON.parse(data);

    }
    return res;
}

function WriteFile(filename = 'weather', jsonBody) {
    let filePath = path.join(__dirname, `/../${filename}.json`);
    if (!ExistsFile(filename)) {
        //console.log("Файл отс")
        fs.writeFileSync(filePath, jsonBody, {}, (err) => {
            if (err) console.log('error!')
        });
    } else {
        fs.writeFile(filePath, jsonBody, {}, (err) => {
            if (err) console.log('error!')
        });

    }

}

function GetWeatherInfo(p) {
    let point = new Point(p.lat, p.long)
    request.get({
        url: "https://api.weather.yandex.ru/v2/forecast?" +
            point.toString() +
            `& lang=RU` +
            `& limit=2` +
            ``,
        headers: {
            ["X-Yandex-API-Key"]: '3bba3282-120c-4ede-a7de-c9ccf8e3a7a8'
        }
    }, async function (error, response, body) {
        // Читаем погоду из JSON, а если ее нет - генерируем
        let Weather = await ReadFile("weather");
        if (!Weather[point]) {
            Weather[point] = {
                value: calcSnowStatistics(JSON.parse(body))
            }
            Weather.expires = Date.now() + 3600 * 36
        } else {
            if (+(Date(Weather?.expires) > +(Date.now()))) {
                Weather[point] = {
                    value: calcSnowStatistics(JSON.parse(body))
                }
                Weather.expires = new Date.now() + 3600 * 36
            }
        }
        WriteFile("weather", JSON.stringify(Weather))
    })
}

// TODO: -
router.get('/generateCoords', async function (req, res, next) {
    WriteFile("weather", JSON.stringify({}))
    //console.log("Очищаем")
    for (let i = -count / 2; i < count / 2; i++) {
        for (let j = -count / 2; j < count / 2; j++) {
            let [x0, y0] = [x + i * deltaX, y + j * deltaY];
            let point = new Point(x0, y0)
            GetWeatherInfo(point);
            await delay(500)
        }
    }
    res.status(200).send({})
});
router.get('/getPoints', async function (req, res, next) {
   let json = await ReadFile("weather")

    let date = new Date(req.query.date) || new Date(Date.now()); // Дата, на какое время строим машрут
    let month = date.getMonth() + 1;
    if (month < 10) month = "0" + month
    // TODO: Remove req.query.day
    let FormatDate = req.query.day || `${date.getFullYear()}-${month}-${date.getDate()}`;

    // Определяем потенциальную последовательность заезда в точки
    for (let StringPoint in json) {
        if (!json.hasOwnProperty(StringPoint) || StringPoint === 'expires') continue
        let Schema_Daytime = json[StringPoint].value;
        Schema_Daytime = Schema_Daytime[FormatDate].parts
        // Определяем, когда лучше сюда ехать (ближе к вечеру, ко дню, к утру)
        Schema_Daytime["type"] = GuessTypePoint(Schema_Daytime);
        let prec_mm =  (getPrecMM(Schema_Daytime['night']) +
            getPrecMM(Schema_Daytime['evening']) +
            getPrecMM(Schema_Daytime['day_short'])+
            getPrecMM(Schema_Daytime['morning']))/4;
        Schema_Daytime["test"] = {
            value:prec_mm || 0
        }
    }
    let coords = {}
    for (let point in json){
        if (!json.hasOwnProperty(point) || point === 'expires') continue;
      //  let obj = json[point].value[FormatDate];
        console.log(json[point]['value'][FormatDate].parts.test.value)
        coords[point]=json[point]['value'][FormatDate].parts.test.value || 0
    }
    // TODO
    res.status(200).json(coords)
})
router.get('/readCoords', async function (req, res, next) {
    let json;
    json = await ReadFile("weather");
   // console.log(json)
    res.status(200).send(json)
});

router.get('/calcPaths', async function (req, res, next) {
    let json = await ReadFile("weather")
    // if (+(Date(json.expires) > +(Date.now()))) {
    //     WriteFile("weather", JSON.stringify({}))
    //     for (let i = -count / 2; i < count / 2; i++) {
    //         for (let j = -count / 2; j < count / 2; j++) {
    //             let [x0, y0] = [x + i * deltaX, y + j * deltaY];
    //             let point = new Point(x0, y0)
    //             GetWeatherInfo(point);
    //             await delay(300)
    //         }
    //     }
    // }
    //await delay(500)
    json = await ReadFile("weather")

    let date = new Date(req.query.date) || new Date(Date.now()); // Дата, на какое время строим машрут
    let month = date.getMonth() + 1;
    if (month < 10) month = "0" + month
    // TODO: Remove req.query.day
    let FormatDate = req.query.day || `${date.getFullYear()}-${month}-${date.getDate()}`;

    // Определяем потенциальную последовательность заезда в точки
    for (let StringPoint in json) {
        if (!json.hasOwnProperty(StringPoint) || StringPoint === 'expires') continue
        let Schema_Daytime = json[StringPoint].value;
        Schema_Daytime = Schema_Daytime[FormatDate].parts

        // Определяем, когда лучше сюда ехать (ближе к вечеру, ко дню, к утру)
        Schema_Daytime["type"] = GuessTypePoint(Schema_Daytime);

    }
    // TODO
    //
    let garages = {}
    let countG = -1;
    for (let garage of Garages) {
        countG++;
        let garagesPoints = []
        for (let StringPoint in json) {
            if (!json.hasOwnProperty(StringPoint) || StringPoint === 'expires'
                || json[StringPoint]['CLEARED']) continue
            //let PointJSON = json[StringPoint];

            let Schema_Daytime = json[StringPoint].value;
            Schema_Daytime = Schema_Daytime[FormatDate].parts

            let point = StrToPoint(StringPoint);


            let distance = Point.Distance(point, garage)

            let prob = (getPrecMM_probability(Schema_Daytime['night']) +
                getPrecMM_probability(Schema_Daytime['evening']) +
                getPrecMM_probability(Schema_Daytime['day_short'])+
                getPrecMM_probability(Schema_Daytime['morning']))/4;

            let prec_mm =  (getPrecMM(Schema_Daytime['night']) +
                getPrecMM(Schema_Daytime['evening']) +
                getPrecMM(Schema_Daytime['day_short'])+
                getPrecMM(Schema_Daytime['morning']))/4;

            garagesPoints.push({
                coords: point,
                distance,
                cnt: prob,
                mm:prec_mm
            })
           // console.log("distance is " + distance)
        }
        let copy = {}
         garagesPoints = garagesPoints.sort(function (a,b) {
            if ( a.mm > b.mm ){
                return -1;
            }
            if ( a.mm < b.mm ){
                return 1;
            }
            return 1;
        }).slice(8*countG,8*countG+8)


         //     garagesPoints = garagesPoints.slice(0,10).sort(function (a,b) {
         //     if ( a.distance < b.distance ){
         //         return -1;
         //     }
         //     if ( a.distance > b.distance ){
         //         return 1;
         //     }
         //     return 1;
         // })
        copy = JSON.parse(JSON.stringify(garagesPoints))

        garagesPoints = garagesPoints.map(function (value,index,array) {
                 return [value.coords.lat,value.coords.long]
             })
        garagesPoints.unshift( [garage.lat, garage.long])
        garagesPoints.push( [garage.lat, garage.long])
        let res = []
        for (let i = 1, len = garagesPoints.length; i < len-1; i++){
            let next = garagesPoints[i]
            let prev = garagesPoints[i-1]
            let s = await addRoute2(prev,next)
            res.push(...s.coordinates)

        }
        console.log(res)

        console.log(copy)
        garages[ garage ] = {res,copy}

    }
    WriteFile('weather', JSON.stringify(json));

    res.status(200).send({
    garages

})
});

function getPrecMM_probability(daytime_json) {
    // TODO: Not if prec_type == 0, only if == 3 (SNOW)
    return +daytime_json['prec_mm'] * +daytime_json['prec_period'] * +daytime_json['prec_strength'] || 0
}
function getPrecMM(daytime_json) {
    // TODO: Not if prec_type == 0, only if == 3 (SNOW)
    return +daytime_json['prec_mm']
}

function GuessTypePoint(json) {
    let NIGHT = getPrecMM_probability(json["night"]);
    let EVENING = getPrecMM_probability(json["evening"]);
    let DAY = getPrecMM_probability(json["day_short"]);
    let MORNING = getPrecMM_probability(json["morning"]);

    let SortObject = {['NIGHT']: NIGHT, ['EVENING']: EVENING, ['DAY']: DAY, ['MORNING']: MORNING}

    let max = 0; // TEMP_VALUE
    let max_type = 'morning' // Мы определяем, когда лучше ехать в эту точку
    for (let k in SortObject) {
        if (!SortObject.hasOwnProperty(k)) continue
        if (SortObject[k] > max) {
            max = SortObject[k];
            switch (k.toLowerCase()) {
                case 'morning':
                    max_type = 1
                    break;
                case 'day':
                    max_type = 2
                    break;
                case 'evening':
                    max_type = 3
                    break;
                case 'night':
                    max_type = 4
                    break;
                default:
                    max_type = 1
                    break;
            }
        }

    }
    //console.log("K="+max_type)
    return max_type
}

//Пока не используется
router.get('/clear', function (req, res, next) {
    WriteFile("weather", JSON.stringify({}))
    res.status(200).send({})
});
async function addRoute2(fromPt, toPt) {

    const fromCoords = fromPt.join(',');
    const toCoords = toPt.join(',');
    const directionsUrl = 'https://api.mapbox.com/directions/v5/mapbox/driving/' +
        fromCoords + ';' + toCoords + '?' +
        'geometries=geojson&' +
        'access_token=pk.eyJ1IjoibWF0dGZpY2tlIiwiYSI6ImNqNnM2YmFoNzAwcTMzM214NTB1NHdwbnoifQ.Or19S7KmYPHW8YjRz82v6g';

    const res = await axios.get(directionsUrl).then(res => res.data);
    return res.routes[0].geometry;

}
async function addRoute(points) {
    let a = ''
    let length = points.length;
    let k =0;
    for (let p of points){
        a = a + `${p[0]},${p[1]}`
        if ( k !== length-1){
            a = a+";"
        }
            k++
    }

    const directionsUrl = 'https://api.mapbox.com/directions/v5/mapbox/driving/' +
        a+
        // '?waypoints=0;2&' +
        '' +
        // 'geometries=geojson&' +
        '?access_token=pk.eyJ1IjoibWF0dGZpY2tlIiwiYSI6ImNqNnM2YmFoNzAwcTMzM214NTB1NHdwbnoifQ.Or19S7KmYPHW8YjRz82v6g';

    return await axios.get(directionsUrl).then(res => res.data);

}
module.exports = router;
