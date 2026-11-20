const plants=[
 {name:'银杏',latin:'Ginkgo biloba L.',family:'银杏科',bg:'#e9ead1',colors:['#b5ba68','#738945','#516d39'],note:'看叶片上缘的小缺口。扇形的叶片从叶柄处展开，细细的叶脉反复分叉，秋日常转为金黄。'},
 {name:'鸡爪槭',latin:'Acer palmatum',family:'无患子科',bg:'#efe0d3',colors:['#d98a57','#ad583d','#803a30'],note:'叶片像一只张开的小手，通常分成五至七个尖裂片，边缘有细锯齿。秋叶常呈橙红色。'},
 {name:'垂柳',latin:'Salix babylonica L.',family:'杨柳科',bg:'#dee8db',colors:['#aec393','#789963','#466c50'],note:'沿着细长下垂的枝条找一找。叶片狭长，先端渐尖，中央有一条清楚的主脉。'}
];
function leafPath(id){
 const p=new Path2D();p.moveTo(0,0);
 if(id===0){
 p.bezierCurveTo(-5,-12,-48,-31,-62,-60);
 for(let i=0;i<=60;i++){let x=-62+i*124/60,y=-84+24*(x/62)**2+11*Math.exp(-((x/6)**2))+1.7*Math.sin(i*1.9);p.lineTo(x,y)}
 p.bezierCurveTo(50,-34,9,-15,0,0)
 }else if(id===1){
 const tips=[[-43,-4],[-61,-38],[-40,-65],[0,-100],[38,-67],[59,-40],[45,-8]],cuts=[[-24,-16],[-26,-28],[-12,-38],[12,-38],[27,-25],[25,-15],[0,0]];
 let a=[0,0];for(let j=0;j<7;j++){for(let b of [tips[j],cuts[j]]){for(let i=1;i<=10;i++){let t=i/10,d=i%2?1.8:0;p.lineTo(a[0]+(b[0]-a[0])*t+d,a[1]+(b[1]-a[1])*t-d)}a=b}}
 }else{p.bezierCurveTo(-14,-19,-11,-65,4,-109);p.bezierCurveTo(10,-72,17,-28,0,0)}
 p.closePath();return p;
}
function drawLeaf(c,id,x,y,s,r,tone=0){
 c.save();c.translate(x,y);c.rotate(r);c.scale(s,s);let p=leafPath(id),[light,mid,dark]=plants[id].colors;let g=c.createLinearGradient(-44,-80,45,-4);g.addColorStop(0,tone?mid:light);g.addColorStop(.55,tone?light:mid);g.addColorStop(1,dark);c.fillStyle=g;c.fill(p);c.strokeStyle=dark;c.lineWidth=.6;c.stroke(p);c.clip(p);c.strokeStyle=dark;c.globalAlpha=.46;c.lineWidth=.57;
 for(let i=-38;i<=38;i++){c.beginPath();if(id===0){const a=i*.021;c.moveTo(0,0);c.quadraticCurveTo(Math.sin(a)*35,-43,Math.sin(a)*132,-109*Math.cos(a))}else if(id===1){let tips=[[-43,-4],[-61,-38],[-40,-65],[0,-100],[38,-67],[59,-40],[45,-8]],k=(i+38)%7,q=Math.floor((i+38)/7)/11,[tx,ty]=tips[k];c.moveTo(0,0);c.lineTo(tx*q,ty*q);c.lineTo(tx*(q+.12)+(i%2?8:-8),ty*(q+.2))}else{let v=(i+38)/77;c.moveTo(v*4,-110*v);c.lineTo(i%2?13:-13,-110*v-12)}c.stroke()}c.restore()
}
function plate(canvas,id,hero=false){
 let W=hero?660:460,H=hero?410:210;canvas.width=W*2;canvas.height=H*2;let c=canvas.getContext('2d');c.scale(2,2);if(!hero){c.fillStyle=plants[id].bg;c.fillRect(0,0,W,H)}
 let seed=13;const rand=()=>((seed=seed*16807%2147483647)/2147483647);
 for(let i=0;i<4500;i++){c.fillStyle='rgba(69,76,43,'+(rand()*.13)+')';c.fillRect(rand()*W,rand()*H,rand()*1.4+.3,.7)}
 c.save();if(hero){c.translate(12,6);c.scale(1.44,1.91)}
 const stem=(a,b,d,e,width)=>{c.beginPath();c.moveTo(...a);c.bezierCurveTo(...b,...d,...e);c.lineWidth=width;c.lineCap='round';c.strokeStyle='#6d7148';c.stroke();c.lineWidth=width*.28;c.strokeStyle='#b8ac81';c.stroke()};
 if(id===0){stem([495,242],[420,173],[282,142],[135,104],3.7);
 let specs=[[355,163,365,109,.91,.45],[337,153,314,88,.92,-.22],[306,145,272,163,.9,-1.95],[277,139,251,104,.82,-.53],[239,132,207,79,.8,-.32],[211,124,167,143,.73,-1.9],[183,118,153,82,.75,-.6],[156,110,112,100,.68,-1.12],[394,181,409,151,.91,.79]];
 for(let [bx,by,x,y,s,r] of specs){stem([bx,by],[bx-2,by-3],[x+3,y+6],[x,y],1.6);drawLeaf(c,0,x,y,s,r,s<.8)}
 }else if(id===1){stem([459,216],[360,169],[265,122],[157,93],3);for(let [bx,by,x,y,s,r] of [[329,154,340,108,.97,.35],[284,132,245,147,.94,-1.89],[245,119,214,95,.95,-.32],[193,104,150,100,.73,-.97]]){stem([bx,by],[bx-10,by],[x+3,y+2],[x,y],1.5);drawLeaf(c,1,x,y,s,r)}}
 else{for(let j=0;j<3;j++){let x=170+j*88;stem([x+90,-30],[x+40,18],[x,118],[x-26,211],1.8);for(let k=0;k<8;k++){let t=k/8;drawLeaf(c,2,x+53-85*t,10+176*t,.48+.15*Math.sin(t*3),k%2?2.62:-2.43,k%3===1)}}}c.restore();
}
