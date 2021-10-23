var express = require('express');
var router = express.Router();
var request = require('request');
const fs = require('fs');
const Point = require("../models/point");
let path = require("path")


// Ход шага для случайных точек на КАРТЕ
const deltaX = 0.01;
const deltaY = 0.005;

let count = 4;
count = Math.sqrt(count);

const Center = [39.557099, 52.605997]
const [x, y] = Center;

const Garages = [
    [39.53994646, 52.6389125],
    [39.52249936, 52.6055795],
]

function StrToPoint(strPoint) {
    let dateRegexp = /lat=(?<lat>[0-9]+\.[0-9]+)&lon=(?<lon>[0-9]+\.[0-9]+)/;
    let groups = strPoint.match(dateRegexp).groups;
    return new Point(groups.lat, groups.lon)
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
                    ["prec_mm"]: parts["night"]["prec_mm"],
                    ["prec_period"]: parts["night"]["prec_period"],
                    ["prec_type"]: parts["night"]["prec_type"],
                    ["prec_strength"]: parts["night"]["prec_strength"],
                },
                evening: {
                    ["prec_mm"]: parts["night"]["prec_mm"],
                    ["prec_period"]: parts["night"]["prec_period"],
                    ["prec_type"]: parts["night"]["prec_type"],
                    ["prec_strength"]: parts["night"]["prec_strength"],
                },
                day_short: {
                    ["prec_mm"]: parts["day_short"]["prec_mm"],
                    ["prec_period"]: parts["day_short"]["prec_period"],
                    ["prec_type"]: parts["day_short"]["prec_type"],
                    ["prec_strength"]: parts["day_short"]["prec_strength"],
                },
                morning: {
                    ["prec_mm"]: parts["morning"]["prec_mm"],
                    ["prec_period"]: parts["morning"]["prec_period"],
                    ["prec_type"]: parts["morning"]["prec_type"],
                    ["prec_strength"]: parts["morning"]["prec_strength"],
                },
                night_short: {
                    ["prec_mm"]: parts["night_short"]["prec_mm"],
                    ["prec_period"]: parts["night_short"]["prec_period"],
                    ["prec_type"]: parts["night_short"]["prec_type"],
                    ["prec_strength"]: parts["night_short"]["prec_strength"],
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
        console.log("Файл отс")
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
        let Weather = await ReadFile("weather");

        if (!Weather[point]) {
            Weather[point] = {
                value: calcSnowStatistics(JSON.parse(body))
                // TODO: Вместо body, возвращать JSON
            }
            Weather.expires = Date.now() + 3600 * 36
        } else {
            if (+(Date(Weather?.expires) > +(Date.now()))) {
                Weather[point] = {
                    value: calcSnowStatistics(body)
                }
                Weather.expires = new Date.now() + 3600 * 36
            } else {

            }

        }
        console.log(Weather)
        WriteFile("weather", JSON.stringify(Weather))
    })
}

// TODO: -
router.get('/generateCoords', async function (req, res, next) {
    WriteFile("weather", JSON.stringify({}))
    console.log("Очищаем")
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

router.get('/readCoords', async function (req, res, next) {
    let json = await ReadFile("weather");

    if (+(Date(json?.expires) > +(Date.now()))) {
        //await generateCoords()
        console.log("Reg")
    }
    json = await ReadFile("weather");
    console.log(json)
    res.status(200).send(json)
});

router.get('/calcPaths', async function (req, res, next) {
    let json = await ReadFile("weather")
    if (+(Date(json?.expires) > +(Date.now()))) {
        WriteFile("weather", JSON.stringify({}))
        console.log("Очищаем")
        for (let i = -count / 2; i < count / 2; i++) {
            for (let j = -count / 2; j < count / 2; j++) {
                let [x0, y0] = [x + i * deltaX, y + j * deltaY];
                let point = new Point(x0, y0)
                GetWeatherInfo(point);
                await delay(300)
            }
        }
    }
    json = await ReadFile("weather")

    let date = new Date(req.query.date) || new Date(Date.now());
    let month = date.getMonth() + 1;
    if (month < 10) month = "0" + month
    let FormatDate = req.query.day || `${date.getFullYear()}-${month}-${date.getDate()}`;


    for (let point in json) {
        if (!json.hasOwnProperty(point) || point === 'expires') continue
        let Schema_Daytime = json[point].value;
        Schema_Daytime = Schema_Daytime[FormatDate].parts

        // Определяем, когда лучше сюда ехать (ближе к вечеру, ко дню, к утру)
        Schema_Daytime["type"] = GuessTypePoint(Schema_Daytime);
        let point = StrToPoint(point)

    }
    WriteFile('weather', JSON.stringify(json));
    res.status(200).send(json)
});

function getPrecMM_probability(daytime_json) {
    // TODO: Not if prec_type == 0, only if == 3 (SNOW)
    return +daytime_json['prec_mm'] * +daytime_json['prec_period'] * +daytime_json['prec_strength'] || 0
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
            switch (k) {
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
    return max_type
}
//Пока не используется
router.get('/clear', function (req, res, next) {
    WriteFile("weather", JSON.stringify({}))
    res.status(200).send({})
});

module.exports = router;
