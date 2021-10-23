class Point {
    constructor(lat0,long0) {
        this.lat  = lat0;
        this.long = long0;
    }
    toString(){
        return `lat=${this.lat}&lon=${this.long}`
    }
   get length(){
        return Math.sqrt( this.lat*this.lat + this.long*this.long)
   }
    static Distance(P1, P2){
        return (new Point(10000*(P2.lat-P1.lat),10000*(P2.long-P1.long))).length
    }
    get mapBoxFormat(){
        return [this.lat,this.long]
    }
}
module.exports = Point;
