/** Original canvas illustrations, with no external footage or audio.
 * Run with PLAYWRIGHT_MODULE pointing to an installed Playwright module.
 * The generated assets are committed; this is not part of the app build.
 */
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
mkdirSync("public/videos", { recursive: true });
try {
  for (const kind of ["supper", "family", "sweet"]) {
    const page = await browser.newPage();
    const clip = await page.evaluate(async kind => {
      const canvas = document.createElement("canvas");
      canvas.width = 480; canvas.height = 600;
      document.body.append(canvas);
      const c = canvas.getContext("2d");
      const cream = "#FEF8F6", forest = "#00372C", brass = "#B8873B", clay = "#B4432F";
      function oval(x,y,rx,ry,color) { c.fillStyle=color; c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); c.fill(); }
      function round(x,y,w,h,r,color) { c.fillStyle=color; c.beginPath(); c.roundRect(x,y,w,h,r); c.fill(); }
      function draw(t) {
        c.fillStyle=cream; c.fillRect(0,0,480,600);
        c.strokeStyle=forest; c.globalAlpha=.06; c.lineWidth=1;
        for(let x=0;x<500;x+=30) {c.beginPath();c.moveTo(x,0);c.lineTo(x,600);c.stroke();}
        for(let y=0;y<620;y+=30) {c.beginPath();c.moveTo(0,y);c.lineTo(480,y);c.stroke();}
        c.globalAlpha=1;
        round(30,28,128,32,16,forest); c.fillStyle=cream; c.font="bold 12px sans-serif"; c.fillText("DISHD / DEMO",45,49);
        c.fillStyle=forest; c.font="italic 38px Georgia";
        c.fillText(kind==="supper" ? "Something good" : kind==="family" ? "A seat for everyone." : "A sweeter ending.",30,126);
        if(kind==="supper") {c.fillText("is on the stove.",30,174);}
        const lift=Math.sin(t*Math.PI*2)*3;
        c.save();c.translate(0,lift);
        oval(240,456,183,25,"#E8DCD6");
        if(kind==="supper") {
          round(61,341,50,30,12,forest);round(369,341,50,30,12,forest);
          round(90,306,300,143,47,forest);oval(240,311,150,48,brass);oval(240,306,136,40,cream);
          for(let i=0;i<75;i++) {const a=i*2.399,r=125*Math.sqrt(i/75);c.save();c.translate(240+Math.cos(a)*r,306+Math.sin(a)*r*.26);c.rotate(a);round(-5,-2,10,4,2,brass);c.restore();}
          for(let i=0;i<9;i++) oval(154+i*22,300+Math.sin(i)*17,10,5,i%2?clay:forest);
          c.fillStyle=cream;c.font="italic 27px Georgia";c.fillText("made with care",151,398);
        } else {
          oval(240,360,185,106,forest);oval(240,352,174,99,cream);oval(240,350,153,82,brass);
          if(kind==="family") {
            for(let i=0;i<110;i++) {const a=i*2.399,r=137*Math.sqrt(i/110); c.save();c.translate(240+Math.cos(a)*r,350+Math.sin(a)*r*.47);c.rotate(a);round(-6,-2,12,4,2,cream);c.restore();}
            for(let i=0;i<8;i++) {const a=i*Math.PI/4;oval(240+Math.cos(a)*117,350+Math.sin(a)*53,16,11,i%2?forest:clay);}
            oval(240,350,35,21,forest);oval(240,350,22,13,brass);
          } else {
            c.strokeStyle=cream;c.lineWidth=2;
            for(let y=304;y<410;y+=10) {c.beginPath();c.moveTo(135,y);c.lineTo(345,y-36);c.stroke();}
            for(let i=0;i<38;i++) {const a=i*2.399,r=101*Math.sqrt(i/38);c.save();c.translate(240+Math.cos(a)*r,341+Math.sin(a)*r*.5);c.rotate(a);round(-5,-2,10,4,2,forest);c.restore();}
          }
        }
        c.restore();
        c.strokeStyle=brass;c.lineWidth=3;c.lineCap="round";
        for(let i=0;i<3;i++){const phase=(t+i*.2)%1; c.globalAlpha=(1-phase)*.5;c.beginPath();const x=200+i*40,y=270-phase*56;c.moveTo(x,y);c.bezierCurveTo(x-15,y-12,x+15,y-22,x,y-35);c.stroke();}
        c.globalAlpha=1;c.fillStyle=forest;c.font="16px sans-serif";
        c.fillText(kind==="supper"?"Good food. A little closer to home.":kind==="family"?"Pass the platter. Stay a little longer.":"Leave a little room for joy.",30,530);
        c.fillStyle=brass;c.font="12px sans-serif";c.fillText("AN ILLUSTRATED KITCHEN STORY",30,566);
      }
      draw(0);
      const poster=canvas.toDataURL("image/png").split(",")[1];
      const stream=canvas.captureStream(20), chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:"video/webm;codecs=vp9",videoBitsPerSecond:420000});
      recorder.ondataavailable=e=>chunks.push(e.data);
      const stopped=new Promise(resolve=>recorder.onstop=resolve);
      recorder.start();const start=performance.now();
      await new Promise(resolve=>{function frame(){const elapsed=performance.now()-start;draw(elapsed/3000);if(elapsed<6000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
      recorder.stop();await stopped;stream.getTracks().forEach(track=>track.stop());
      const video=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(",")[1]);reader.readAsDataURL(new Blob(chunks,{type:"video/webm"}));});
      return {poster,video};
    }, kind);
    writeFileSync(`public/videos/${kind}.png`,Buffer.from(clip.poster,"base64"));
    writeFileSync(`public/videos/${kind}.webm`,Buffer.from(clip.video,"base64"));
    console.log(`Generated ${kind}: ${Math.round(Buffer.byteLength(clip.video,"base64")/1024)} KB video`);
    await page.close();
  }
} finally { await browser.close(); }
