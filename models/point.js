class Point {
    constructor(lat0,long0) {
        this.lat  = lat0;
        this.long = long0;
    }
    toString(){
        return `lat=${this.lat}&lon=${this.long}`
    }
   get length(){
        return Math.sqrt( this.lat^2 + this.long^2)
   }
    static Distance(P1, P2){
        return (new Point(P2.lat-P1.lat,P2.long-P1.long)).length
    }
}
module.exports = Point;
