// ═══════════════════════════════════════
// app.js — 앱 초기화
// ═══════════════════════════════════════

// 테마 초기화 (즉시 실행 — API 의존성 없음)
(function(){
  var saved=localStorage.getItem('yt_theme');
  if(saved==='dark'||((!saved)&&window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches)){
    document.documentElement.setAttribute('data-theme','dark');
    setTimeout(function(){var btn=$('themeToggle');if(btn)btn.classList.add('on');},0);
  }
})();

// 앱 초기화 — patchApi를 먼저 동기 호출하여 Api 프록시 확정
(function(){
  if(typeof patchApi==='function') patchApi();
  buildSb();
  buildPanels();
  sOn('step',function(){syncSb();showP();});
  sOn('mx',syncSb);
  syncSb();
  showP();
})();
