var cover = document.getElementById('cover');
var muteIcon = document.getElementById('mute');

//rotate2d
function rotate2D(x, y, angle){
    return [
        Math.cos(angle)*x - Math.sin(angle)*y,
        Math.cos(angle)*y + Math.sin(angle)*x
    ]
}

var parentWindow = null;
var sendMessage = function(message){
    if(parentWindow == null) return;
    parentWindow.postMessage(message);
};

const BPM = 112;
const Bar_Seconds = 15 / 7;
const Bit_Seconds = 5 / 448;
const Bit_Milliseconds = 625 / 56;

let disabled = false;

let Cube = {
    element: document.getElementById('cube'),
    faces: [...document.getElementById('cube').children],
    
    screenSize: innerWidth,
    
    transformScale: false,
    scale: 1,
    
    originalRotation: [Math.rad(-35.264389682754654),Math.rad(-45)],
    baseRotation: [0, 0],
    rotation: [Math.rad(35.264389682754654), Math.rad(45)],
    rotatePoint(p){
        var a = rotate2D(p[0], p[2], -(this.originalRotation[1] + this.rotation[1]));
        var b = rotate2D(p[1], a[1], -(this.originalRotation[0] + this.rotation[0]));
        return [a[0],b[0],b[1]];
    },
    
    /*
    For gray:
    At 1,0,0: color is #333 aka 51/255
    At 0,1,0: color is #AAA aka 170/255
    At 0,0,1: color is #444 aka 68/255
    
    Blackest is 36/255, whitest is 204/255
    
    Math.invlerp(36, 204, 51) = 0.08928571428571429
    Math.invlerp(36, 204, 170) = 0.7976190476190477
    Math.invlerp(36, 204, 68) = 0.19047619047619047
    
    https://matrix.reshish.com/gauss-jordanElimination.php
    0.7071067811865476 -0.408248290463863 0.5773502691896257 0.08928571428571429
    0 0.816496580927726 0.5773502691896258 0.7976190476190477
    -0.7071067811865475 -0.4082482904638631 0.5773502691896258 0.19047619047619047

    Light source direction:
    -0.07155247190578157873 0.53704090590781983946 0.62202618287691831284
    */
    light: [-0.07155247190578157873, 0.53704090590781983946, 0.62202618287691831284],
    lambert(p){
        var R = this.rotatePoint(p),
            a = Math.max(this.light[0] * R[0] + this.light[1] * R[1] + this.light[2] * R[2],0);
        return Math.lerp(36, 204, a) / 255;
    },
    
    color(){
        /*this.faces[0].style.background = this.getColor( 0, 1, 0);
        this.faces[1].style.background = this.getColor( 0,-1, 0);
        this.faces[2].style.background = this.getColor( 1, 0, 0);
        this.faces[3].style.background = this.getColor(-1, 0, 0);
        this.faces[4].style.background = this.getColor( 0, 0, 1);
        this.faces[5].style.background = this.getColor( 0, 0,-1);*/
        
        this.faces[0].style.background = Colors[ID][1];
        this.faces[1].style.background = Colors[ID][1];
        this.faces[2].style.background = Colors[ID][0];
        this.faces[3].style.background = Colors[ID][0];
        this.faces[4].style.background = Colors[ID][2];
        this.faces[5].style.background = Colors[ID][2];
    },
    
    update(){
        this.element.style.transform = `rotateX(${Math.deg(this.originalRotation[0] + this.rotation[0])}deg) rotateY(${Math.deg(this.originalRotation[1] + this.rotation[1])}deg)`;
        //this.color();
    },
    
    rotate(offsetX, offsetY){
        // Math.rad(-90) - Cube.baseRotation[0], Math.rad(90) - Cube.baseRotation[0]
        this.rotation[0] = this.baseRotation[0] + (offsetY / this.screenSize * -5);
        this.rotation[1] = this.baseRotation[1] + (offsetX / this.screenSize * 5);
        
        this.rotation[0] = Math.clamp(this.rotation[0], -0.9553166181245092, 2.186276035465284);
        
        this.update();
        
        if(ID == 15){
            sendMessage({
                _relay: true,
                name: 'rotate',
                rotation: this.rotation
            });
        }
    },
    
    spin(){
        Cube.rotation[1] += Math.PI;
        Cube.drag = false;
        Cube.idleFrames = 0;
    },
    spinOut(){
        this.spin();
        disabled = true;
        this.drag = false;
        
        this.element.style.transform = `rotateX(-35.264389682754654deg) rotateY(315deg) scale3d(0,0,0)`;
        this.element.style.transition = 'transform 500ms';
    },
    
    drag: false,
    mouseStartX: 0,
    mouseStartY: 0,
    
    mousedown(event){
        if(disabled) return;
        if(event.button == 1){
            log('highlight');
            sendMessage({
                name:'highlight',
                id: ID
            });
            return;
        }else if(event.button != 0) return;
        
        this.drag = true;
        this.mouseStartX = event.pageX;
        this.mouseStartY = event.pageY;
        
        this.baseRotation[0] = this.rotation[0];
        this.baseRotation[1] = this.rotation[1];
        
        if(ID == 15){
            sendMessage({
                _relay: true,
                name: 'override',
                override: true,
                rotation: this.rotation,
            });
        }
    },
    mousemove(event){
        if(!Cube.drag) return;
        if(event.buttons == 0){
            this.mouseup(event);
        }
        
        this.rotate(event.pageX - Cube.mouseStartX, event.pageY - Cube.mouseStartY);
    },
    mouseup(event){
        this.drag = false;
        
        this.rotate[1] = Math.mod(this.rotation[1] - Math.PI, Math.TAU) - Math.PI;
        this.idleFrames = 0;
        
        if(ID == 15){
            sendMessage({
                _relay: true,
                name: 'override',
                override: false,
            });
        }
    },
    mouseleave(event){
        if(this.drag) this.mouseup(event);
    },

    touchstart(event){
        event.pageX = event.changedTouches[0].pageX;
        event.pageY = event.changedTouches[0].pageY;
        this.mousedown(event);
    },
    touchmove(event){
        event.pageX = event.changedTouches[0].pageX;
        event.pageY = event.changedTouches[0].pageY;
        this.mousemove(event);
    },
    touchend(event){
        this.mouseup(event);
    },
    
    idleFrames: 0,
    maxIdleFrames: 120,
    smoothRotateBack(deltaTime){
        this.idleFrames++;
        if(this.idleFrames == this.maxIdleFrames){
            this.rotation[0] = 0;
            this.rotation[1] = 0;
        }else{
            this.rotation[0] *= Math.exp(-4 * deltaTime);
            this.rotation[1] *= Math.exp(-4 * deltaTime);
        }
        this.update();
    },
    
    delayAmount: [
        4.24,3.60,3.16,3.00,
        3.60,2.83,2.23,2.00,
        3.16,2.23,1.41,1.00,
        3.00,2.00,1.00,0
    ],
    rotationOverride: [0,0],
    rotateOverride(deltaTime){
        this.rotation[0] = Math.lerp(this.rotation[0],this.rotationOverride[0],Math.exp(-10 * this.delayAmount[ID] * deltaTime));
        this.rotation[1] = Math.lerp(this.rotation[1],this.rotationOverride[1],Math.exp(-10 * this.delayAmount[ID] * deltaTime));
        
        this.update();
    },
    
    animate(deltaTime){
        if(!this.drag && this.idleFrames <= this.maxIdleFrames) this.smoothRotateBack(deltaTime);
        
        if(this.override) this.rotateOverride(deltaTime);
    },
    
    incomingMessage(data){
        if(data.name == 'override' && ID != 15){
            
            this.override = data.override;
            this.rotationOverride = data.rotation;
            if(this.override == false) this.idleFrames = 0;
            
        }else if(data.name == 'rotate'){
            this.rotationOverride = data.rotation;
        }
    },
    
    setSize(quick){
        this.screenSize = Math.min(innerWidth, innerHeight);
        var s = Math.floor(this.screenSize * 0.27), S = s + s;
        this.element.style.width = S + 'px';
        this.element.style.height = S + 'px';
        this.element.style.setProperty('--s', s + 'px');
        
        if(quick) return;
        
        this.element.setAttribute('moving','true');
        setTimeout(() => {
            this.element.removeAttribute('moving');
        }, 250);
    },
    
    init(){
        this.setSize(true);
        //this.color();
        
        document.body.addEventListener("mousedown", event => Cube.mousedown(event));
        document.body.addEventListener("mousemove", event => Cube.mousemove(event));
        document.body.addEventListener("mouseup",   event => Cube.mouseup(event));
        document.body.addEventListener("mouseleave",event => Cube.mouseleave(event));
        document.body.addEventListener("touchstart", event => Cube.touchstart(event));
        document.body.addEventListener("touchmove", event => Cube.touchmove(event));
        document.body.addEventListener("touchend", event => Cube.touchend(event));
        
        window.onresize = event => {
            log(event);
            Cube.setSize(true);
        };
        
        this.idleFrames = 0;
    },
};

let Time = {
    initTime: 0,
    
    offset: 0,
    audioOffset: 0,
    frameOffset: 0,
    updateOffsets(){
        this.audioOffset = this.offset / 1000;
        this.frameOffset = this.offset;
        this.setupTest();
    },
    setOffset(time){
        this.offset = (time - this.initTime);
        this.updateOffsets();
    },
    setOffsetUnix(time){
        this.offset = ((time - performance.timeOrigin) - this.initTime);
        this.updateOffsets();
    },
    setOffsetNow(){
        this.offset = (performance.now() - this.initTime);
        this.updateOffsets();
    },
    
    test: false,
    frameTests: [],
    
    setupTest(){
        this.test = true;
        this.frameTests = [];
    },
    endTest(){
        this.test = false;
        var avg = this.frameTests.average();
        log(avg);
        
        Time.initTime -= this.frameTests.average();
    },
    
    update(now){
        if(!this.test) return;
        
        this.frameTests.push(
            (Audio.ctx.currentTime * 1000) - (now - Time.initTime)
        );
        if(this.frameTests.length == 40) this.endTest();
    },
};

var Frames = {
    frame: [],
    create(){
        var frame = document.createElement('div');
        frame.id = 'frame';
        for(var i=0;i<81;i++){
            frame.appendChild(document.createElement('pxl'));
        }
        this.frame.push(frame);
        return frame;
    },
    
    drawTile(frameID, tileID){
        Tiles[ID][tileID].forEach((n,i) => {
            for(var j=0;j<9;j++){
                this.frame[frameID].children[i * 9 + j].style.backgroundColor = 
                ((n >> j) & 1) ? Colors[ID][4] : null;
            }
        })
    },
    
    clear(frameID){
        for(var i=0;i<9;i++){
            for(var j=0;j<9;j++){
                this.frame[frameID].children[i * 9 + j].style.backgroundColor = null;
            }
        }
    },
    
    currentLeft: null,
    currentRight: null,
    cue: [],
    
    updateCurrent(){
        var col = (this.currentLeft == null && this.currentRight == null) ? Colors[ID][1] : Colors[ID][3];
        Cube.faces[0].style.background = col;
        Cube.faces[1].style.background = col;
    },
    updateLeft(){
        var left = this.currentLeft;
        if(left != null){
            this.drawTile(2, left[0] - 1);
            this.drawTile(3, left[0] - 1);
        }else{
            this.clear(2);
            this.clear(3);
        }
        
        this.updateCurrent();
    },
    updateRight(){
        var right = this.currentRight;
        if(right != null){
            this.drawTile(0, right[0] - 1);
            this.drawTile(1, right[0] - 1);
        }else{
            this.clear(0);
            this.clear(1);
        }
        
        this.updateCurrent();
    },
    
    applyCue(){
        var cue = this.cue[0];
        
        if(cue.end){
            endSong();
            return;
        }
        
        var config = TileConfigs[ID][cue.config],
            A = config[0], B = config[1];
        
        if(A > 0){
            this.currentLeft = [A, cue.endTime];
            this.updateLeft();
        }
        if(B > 0){
            this.currentRight = [B, cue.endTime];
            this.updateRight();
        }
        
        this.cue.shift();
    },
    
    update(time){
        // hacky way of saying there could be 2 at once
        if(this.cue[0] && time >= this.cue[0].time) this.applyCue();
        if(this.cue[0] && time >= this.cue[0].time) this.applyCue();
        
        if(this.currentLeft != null && time >= this.currentLeft[1]){
            this.currentLeft = null;
            this.updateLeft();
        }
        if(this.currentRight != null && time >= this.currentRight[1]){
            this.currentRight = null;
            this.updateRight();
        }
    },
    
    add(configID, time, dur){
        this.cue.push({
            config: configID,
            time: time,
            endTime: time + dur,
        });
    },
    
    init(){
        for(var i = 2; i < 6; i ++){
            Cube.faces[i].appendChild(this.create());
        }
    }
}

var Song = null;
function loadSong(){
    fetch(`../song/${ID}.json`)
    .then(res => res.json())
    .then(data => {
        Song = data;
    });
};

var Audio = {
    ctx: null,
    node: null,
    volume: 0.5,
    
    tickBuffer: null,
    tick(bitTime){
        var s = Audio.ctx.createBufferSource();
        var buffer = Audio.tickBuffer;
        s.buffer = buffer;
        s.connect(Audio.node);
        
        s.start(Time.audioOffset + bitTime * Bit_Seconds);
        
        s.onended = () => {
            s.disconnect();
            delete s;
        };
        
        log(performance.timeOrigin + Time.initTime + Time.audioOffset + bitTime * Bit_Seconds);
        
        sendMessage({
            name: 'tickInfo',
            id: ID,
            time: performance.timeOrigin + Time.initTime + Time.offset + bitTime * Bit_Milliseconds
        });
    },
    
    soundBuffers: [],
    loadSounds(){
        var soundBuffers = this.soundBuffers;
        Sounds[ID].forEach((sound,soundIndex) => {
            fetch(`../wav/${Names[ID]}/${sound}.wav`)
            .then(res => res.arrayBuffer())
            .then(data => Audio.ctx.decodeAudioData(data))
            .then(buffer => {
                soundBuffers[soundIndex] = buffer;
            });
        });
        
        
        fetch('../wav/tick.wav')
        .then(res => res.arrayBuffer())
        .then(data => Audio.ctx.decodeAudioData(data))
        .then(buffer => {
            Audio.tickBuffer = buffer;
        })
    },
    playSound(i, bitTime, dur){
        if(dur) Frames.add(i, bitTime * Bit_Milliseconds, dur * Bit_Milliseconds);
        else Frames.add(i, bitTime * Bit_Milliseconds, TileDurations[ID][i] * Bit_Milliseconds);
        
        //Out of attached sound range
        if(i >= Audio.soundBuffers.length) return;
        
        var s = Audio.ctx.createBufferSource();
        var buffer = Audio.soundBuffers[i];
        s.buffer = buffer;
        s.connect(Audio.node);
        
        if(dur) s.start(Time.audioOffset + bitTime * Bit_Seconds, 0, dur * Bit_Seconds);
        else s.start(Time.audioOffset + bitTime * Bit_Seconds);
        
        s.onended = () => {
            s.disconnect();
            delete s;
        };
    },

    playBar(i,bitTime){
        Song[i].forEach(n => {
            if(n[2]) Audio.playSound(n[1], n[0] + bitTime, n[2]);
            else Audio.playSound(n[1], n[0] + bitTime);
        });
    },
    playSection(bar){
        for(var i = 0; i < 4; i++){
            this.playBar(bar + i, 192 * i);
        }
    },
    playSong(){
        for(var i = 0; i < Song.length; i++){
            this.playBar(i, 192 * i + 192);
        }
    },
    
    muted: false,
    mousedown(event){
        if(event.button != 2) return;
        
        this.muted = !this.muted;
        
        this.node.gain.linearRampToValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime + 0.05);
        muteIcon.style.display = this.muted ? 'block' : 'none';
    },

    init(){
        this.ctx = new AudioContext();
        Time.initTime = performance.now();
        this.node = this.ctx.createGain();
        this.node.gain.value = this.volume;
        this.node.connect(this.ctx.destination);
        /*var o = Audio.ctx.createOscillator();
        o.connect(this.node);
        o.start();*/
        Audio.loadSounds();
        
        Time.offset = 0;
        Time.updateOffsets();
        Time.test = true;
        
        document.body.addEventListener('mousedown', event => this.mousedown(event));
    },
};

function playSong(){
    Audio.playSong();
    Frames.cue.push({
        time: 167142.85714285716,
        end: true
    });
}

function endSong(){
    setTimeout(() => {
        Cube.spinOut();
    }, SpinDelay[ID]);
    setTimeout(() => {
        window.close();
    }, 1000);
}

window.addEventListener("message", (event) => {
    console.log(event);
    var data = event.data;
    
    if(data.name == 'ping'){
        parentWindow = event.source;
        event.source.postMessage({
            name: 'ping',
            source: ID
        });
    }

    if(data.name == 'spin'){
        setTimeout(() => {
            Cube.spin();
        }, SpinDelay[ID] * 100);
    }else if(data.name == 'setSize'){
        Cube.setSize();
    }

    if(data.name == 'play'){
        Time.setOffsetUnix(data.time);
        playSong();
    }else if(data.name == 'test'){
        Time.setOffsetUnix(data.time);
        Audio.playSound(1, 192);
    }else if(data.name == 'bar'){
        Time.setOffsetUnix(data.time);
        Audio.playBar(data.bar, 50);
    }else if(data.name == 'tick'){
        Time.setOffsetUnix(data.time);
        Audio.tick(12 * ID);
    }
    
    Cube.incomingMessage(data);
});

var lastTick = 0;
function animate(){
    if(disabled) return;
    
    const now = performance.now();
    const deltaTime = (performance.now() - lastTick) * 0.001;
    lastTick = now;
    
    Cube.animate(deltaTime);
    Frames.update(now - Time.initTime - Time.offset);
    Time.update(now);
    
    window.requestAnimationFrame(animate);
}

var loaded = false;
function load(){
    if(loaded) return;
    
    Cube.init();
    Frames.init();
    Audio.init();
    loadSong();
    
    lastTick = performance.now();
    window.requestAnimationFrame(animate);
    
    loaded = true;
    cover.style.opacity = 0;
    setTimeout(() => {
        document.body.removeChild(cover);
    }, 500);

    sendMessage({name:'loaded',source: ID});
}
//load();
cover.addEventListener('click', load);