// ═══════════════════════════════════════
// state.js — 상태 관리
// ═══════════════════════════════════════

var S={step:1,mx:1,user:null,skw:[],vids:[],sv:null,transcript:'',ana:null,sty:'s1',scr:null,fcs:[],es:'',ekw:[],selVoice:'vc4',vdone:false,voiceResult:null,elVoiceId:null,scriptHistory:[]};
var _cb={};
function sSet(u){var p=Object.assign({},S);Object.assign(S,u);for(var k in u){if(_cb[k])_cb[k].forEach(function(f){f(S[k],p[k])});};if(_cb['*'])_cb['*'].forEach(function(f){f(S,p);});try{var sv={step:S.step,mx:S.mx,skw:S.skw,sv:S.sv,ana:S.ana,scr:S.scr,es:S.es,ekw:S.ekw,selVoice:S.selVoice};localStorage.setItem('yt_a_progress',JSON.stringify(sv));}catch(e){}}
function sOn(k,f){if(!_cb[k])_cb[k]=[];_cb[k].push(f);}
function sGo(n){
  if(n>S.mx)return;
  // 역주행 시 이후 단계 데이터 초기화
  if(n<S.step){
    var clear={};
    if(n<=2)Object.assign(clear,{skw:[],vids:[],sv:null,transcript:''});
    if(n<=3)Object.assign(clear,{sv:null,transcript:''});
    if(n<=4)Object.assign(clear,{ana:null});
    if(n<=5)Object.assign(clear,{scr:null,es:'',scriptHistory:[],fcs:[]});
    if(n<=6)Object.assign(clear,{fcs:[]});
    if(n<=7)Object.assign(clear,{ekw:[]});
    if(n<=8)Object.assign(clear,{thumbs:null});
    if(n<=9)Object.assign(clear,{vdone:false,voiceResult:null});
    sSet(Object.assign(clear,{step:n,mx:n}));
  }else{
    sSet({step:n});
  }
}
function sNext(){var n=S.step+1;sSet({step:n,mx:Math.max(S.mx,n)});}
function sPrev(){
  if(S.step>2){
    var n=S.step-1;
    sGo(n);
  }
}
