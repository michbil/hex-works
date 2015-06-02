function scrollFilter() {
    var NOMINAL_FRICTION=0.97;
    var mass = 5; //kg
    var friction = 0.005;
    var speed=0.0,position=0.0;
    var startTime;
}

function setFriction(f) {
    this.friction = f;
}


function Filter(mass, friction)
{
    setCoef(mass,friction);
}

function setCoef(double mass,double friction) {

    this.mass = mass;
    this.friction = friction;
    startTime = System.currentTimeMillis();
}

function doFilter(acceleration) {

    acceleration = acceleration;

    double t = ((double)(System.currentTimeMillis()-startTime)/1000);
    startTime = System.currentTimeMillis();

    speed = (float) (mass * acceleration * t + speed);
    position += mass * acceleration / 2 * t * t + speed * t;
    speed *= friction;

    if (position > 0) {
        speed=-0.05f;

        position=0;
    }

    return position;

}
