// ═══════════════════════════════════════
// utils.js — 유틸리티 함수
// ═══════════════════════════════════════

function $(id){return document.getElementById(id);}
function esc(s){if(!s)return'';var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function fmt(n){return n>=10000?(n/10000).toFixed(1)+'만':n>=1000?(n/1000).toFixed(1)+'K':String(n);}
function toast(m,t){var w=$('tw'),d=document.createElement('div');d.className='tst tst-'+(t||'ok');d.innerHTML='<span class="tst-i">'+(t==='err'?'✕':'✓')+'</span>'+esc(m);w.appendChild(d);setTimeout(function(){d.remove();},3500);}
function wait(ms){return new Promise(function(r){setTimeout(r,ms+Math.random()*300);});}
function b64toBlob(b64,type){
  var bin=atob(b64);var len=bin.length;var arr=new Uint8Array(len);
  for(var i=0;i<len;i++)arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:type||'audio/mp3'});
}
function fmtB(b){return b>=1024?(b/1024).toFixed(1)+' KB':b+' B';}

var NEWS_CH=['KBS','MBC','SBS','JTBC','MBN','TV조선','YTN','연합뉴스','뉴스','채널A','CBS','한국경제TV','매일경제','조선일보','중앙일보','한겨레','경향신문'];
var BREAKING_KW=['속보','긴급','실시간','브리핑','단독','생중계','현장','기자회견','발표'];
var PLANNED_KW=['분석','정리','이유','비밀','진짜','총정리','심층','비교','논란','정체','충격','반전','전망','예측','해설','요약','팩트','검증','리뷰'];
function isNews(name){return NEWS_CH.some(function(n){return name.indexOf(n)!==-1;});}
function isBreaking(title){return BREAKING_KW.some(function(k){return title.indexOf(k)!==-1;});}
function isPlanned(title){return PLANNED_KW.some(function(k){return title.indexOf(k)!==-1;});}
function scoreVids(vids){
  var mx=Math.max.apply(null,vids.map(function(v){return v.views;}).concat([1]));
  return vids.map(function(v){
    // 기본 점수: 조회수 절대값(30%) + 조회수/구독자 비율(40%)
    var ratio=v.subs>0?Math.min(v.views/v.subs,100)/100:0;
    var raw=(v.views/mx*0.3)+(ratio*0.4);
    // ① 뉴스/속보형 감점
    var news=isNews(v.ch);
    var breaking=isBreaking(v.title);
    var newsMulti=news?0.25:(breaking?0.5:1);
    // ① 기획형 가점
    var planned=isPlanned(v.title);
    var plannedMulti=planned?1.3:1;
    // ② 구독자 구간별 가중치 (낮을수록 대박 컨텐츠)
    var subMulti=1;
    if(v.subs<10000&&v.views>50000)subMulti=2.0;       // 구독 1만↓ + 조회 5만↑ → 최고
    else if(v.subs<50000&&v.views>30000)subMulti=1.7;   // 구독 5만↓ + 조회 3만↑
    else if(v.subs<100000&&v.views>50000)subMulti=1.4;  // 구독 10만↓ + 조회 5만↑
    else if(v.subs>500000)subMulti=0.7;                  // 대형 채널 감점
    // 최종 점수
    v.score=Math.round(raw*newsMulti*plannedMulti*subMulti*100);
    v.news=news;
    v.planned=planned;
    return v;
  }).sort(function(a,b){return b.score-a.score;});
}

var STEPS=[{n:1,l:'라이선스 인증'},{n:2,l:'키워드 선택'},{n:3,l:'영상 리스트'},{n:4,l:'영상 선택'},{n:5,l:'영상 분석'},{n:6,l:'스크립트 생성'},{n:7,l:'팩트 검증'},{n:8,l:'풋티지 브리프'},{n:9,l:'썸네일 문구'},{n:10,l:'음성 생성'},{n:11,l:'결과 확인'}];
var PROG_MSG=['키워드를 선택해주세요','키워드 기반으로 영상을 검색합니다','분석할 영상을 선택하세요','선택한 영상을 확인합니다','AI가 영상을 분석합니다','스타일을 선택하고 대본을 생성합니다','허위사실을 검증합니다','장면별 풋티지를 추천합니다','썸네일 문구를 생성합니다','AI 음성을 생성합니다','모든 작업이 완료되었습니다'];

// ── API 타임아웃 래퍼 ──
function withTimeout(promise,ms,msg){
  return new Promise(function(resolve,reject){
    var done=false;
    var timer=setTimeout(function(){if(!done){done=true;reject(new Error(msg||'요청 시간이 초과되었습니다 ('+(ms/1000)+'초). 다시 시도해주세요.'));}},ms);
    promise.then(function(r){if(!done){done=true;clearTimeout(timer);resolve(r);}}).catch(function(e){if(!done){done=true;clearTimeout(timer);reject(e);}});
  });
}
