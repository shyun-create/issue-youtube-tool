// ═══════════════════════════════════════
// pipeline.js — 숏폼 제작 9단계 파이프라인
// Step 2: 키워드 선택 ~ Step 11: 결과 확인
// ═══════════════════════════════════════

// ── Step 2: 키워드 선택 ──
window.ls2=function(){var p=$('p2');if(p.dataset.ok)return;p.dataset.ok='1';
  p.innerHTML='<h2 class="pt">키워드 선택</h2><p class="pd">실시간 이슈 키워드를 선택하세요. 클릭하면 연관 키워드가 표시됩니다.</p><div id="ilSection"><div class="ld" style="padding:30px"><div class="sp"></div>이슈링크에서 실시간 데이터 불러오는 중...</div></div><div id="gtSection" style="margin-top:16px"><div class="ld" style="padding:20px"><div class="sp"></div>Google Trends에서 불러오는 중...</div></div><div id="relPanel" style="display:none;margin-top:16px"></div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:24px"><span style="font-size:13px;color:var(--t3);font-weight:500" id="kc">선택: 0개</span><button class="btn bp btn-lg" id="knxt" disabled>다음 단계 →</button></div>';
  $('knxt').onclick=function(){sNext();};
  window._ilKw={};

  // 키워드 클릭 핸들러 (이슈링크 + Google Trends 공용)
  function setupKwClick(container){
    container.onclick=function(e){
      var t=e.target.closest('[data-kwid]');if(!t)return;
      var wasOn=t.classList.contains('on');
      document.querySelectorAll('[data-kwid].on').forEach(function(x){x.classList.remove('on');});
      $('relPanel').style.display='none';
      if(!wasOn){
        t.classList.add('on');
        var kwId=t.dataset.kwid;
        var kw=window._ilKw[kwId];
        if(kw){
          sSet({skw:[kw]});$('kc').textContent='선택: 1개';$('knxt').disabled=false;
          showRelated(kw);
        }
      }else{
        sSet({skw:[]});$('kc').textContent='선택: 0개';$('knxt').disabled=true;
      }
    };
  }

  // 이슈링크 로드
  Api.getIssueLink().then(function(data){
    var html='';
    if(data.hotKeywords.length){
      html+='<div class="cd" style="border-color:var(--acc-ring)"><div class="st" style="margin-bottom:12px;display:flex;align-items:center;gap:8px;color:var(--acc)"><span style="width:6px;height:6px;border-radius:50%;background:var(--acc);display:inline-block"></span>이슈링크 실시간 핫이슈 TOP 10<span class="bdg ba" style="font-size:10px">LIVE</span></div>';
      html+='<div style="display:flex;flex-wrap:wrap;gap:8px">';
      data.hotKeywords.forEach(function(k,i){
        html+='<div class="tag" data-kwid="hot-'+i+'" style="padding:8px 16px;font-size:13px;display:inline-flex;align-items:center;gap:8px"><span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--acc);min-width:16px">'+(i+1)+'</span><span>'+esc(k.keyword)+'</span></div>';
      });
      html+='</div></div>';
    }else{
      html='<div class="cd" style="border-style:dashed"><div style="text-align:center;padding:12px;color:var(--t3);font-size:13px">이슈링크 데이터를 불러올 수 없습니다</div></div>';
    }
    $('ilSection').innerHTML=html;
    data.hotKeywords.forEach(function(k,i){window._ilKw['hot-'+i]={id:'hot-'+i,label:k.keyword,src:'이슈링크 핫이슈',score:100-i*5,tags:[],period:'weekly'};});
    setupKwClick($('ilSection'));
  });

  // Google Trends 로드
  Api.getTrends().then(function(keywords){
    var html='';
    if(keywords.length){
      html+='<div class="cd" style="border-color:#4285F4"><div class="st" style="margin-bottom:12px;display:flex;align-items:center;gap:8px;color:#4285F4"><span style="width:6px;height:6px;border-radius:50%;background:#4285F4;display:inline-block"></span>Google Trends 실시간 인기 검색어<span class="bdg" style="font-size:10px;background:rgba(66,133,244,0.1);color:#4285F4">KR</span></div>';
      html+='<div style="display:flex;flex-wrap:wrap;gap:8px">';
      keywords.forEach(function(k,i){
        var tid='gt-'+i;
        window._ilKw[tid]={id:tid,label:k.keyword,src:'Google Trends',score:90-i*3,tags:[],period:'daily'};
        html+='<div class="tag" data-kwid="'+tid+'" style="padding:8px 16px;font-size:13px;display:inline-flex;align-items:center;gap:8px"><span style="font-family:var(--mono);font-size:11px;font-weight:700;color:#4285F4;min-width:16px">'+(i+1)+'</span><span>'+esc(k.keyword)+'</span>'+(k.traffic?'<span style="font-size:10px;color:var(--t4)">'+esc(k.traffic)+'</span>':'')+'</div>';
      });
      html+='</div></div>';
    }else{
      html='<div class="cd" style="border-style:dashed"><div style="text-align:center;padding:12px;color:var(--t3);font-size:13px">Google Trends 데이터를 불러올 수 없습니다</div></div>';
    }
    $('gtSection').innerHTML=html;
    setupKwClick($('gtSection'));
  });
};
var _currentRelatedId=0;
function showRelated(kw){
  var relId=++_currentRelatedId;
  var rp=$('relPanel');rp.style.display='block';
  rp.innerHTML='<div class="cd" style="border-color:var(--acc-ring);background:var(--acc-bg)"><div class="st" style="margin-bottom:12px;color:var(--acc)">🔗 "'+esc(kw.label)+'" 연관 키워드</div><div style="display:flex;align-items:center;gap:8px;color:var(--t3);font-size:13px"><div class="sp" style="width:18px;height:18px;border-width:2px"></div>YouTube에서 실시간 키워드를 불러오는 중...</div></div>';
  
  // Step 1: YouTube Suggest로 실시간 키워드 가져오기
  var cbName='_ytSuggest_'+Date.now();
  window[cbName]=function(data){
    delete window[cbName];
    var script=document.getElementById('ytSuggestScript_'+relId);if(script)script.remove();
    if(relId!==_currentRelatedId)return; // stale response 무시
    var raw=[];
    if(data&&data[1]){data[1].forEach(function(item){if(item&&item[0]&&item[0]!==kw.label)raw.push(item[0]);});}
    if(raw.length===0){rp.innerHTML='<div class="cd" style="border-color:var(--acc-ring);background:var(--acc-bg)"><div style="text-align:center;padding:12px;color:var(--t3);font-size:13px">연관 키워드를 찾을 수 없습니다</div></div>';return;}
    
    // Step 2: Gemini로 무관한 키워드 필터링
    if(hasKey('llm')){
      rp.innerHTML='<div class="cd" style="border-color:var(--acc-ring);background:var(--acc-bg)"><div class="st" style="margin-bottom:12px;color:var(--acc)">🔗 "'+esc(kw.label)+'" 연관 키워드</div><div style="display:flex;align-items:center;gap:8px;color:var(--t3);font-size:13px"><div class="sp" style="width:18px;height:18px;border-width:2px"></div>AI가 관련성을 분석하고 있습니다... ('+raw.length+'개 중 필터링)</div></div>';
      var prompt='아래는 "'+kw.label+'"의 YouTube 자동완성 검색어 목록입니다.\n\n'+JSON.stringify(raw)+'\n\n이 중에서 "'+kw.label+'"과 실제로 같은 주제/이슈/사건과 관련된 키워드만 골라주세요.\n\n[규칙]\n- 글자만 비슷하고 의미가 다른 것은 제거 (예: "마이크" 키워드에서 "마이클잭슨"은 제거)\n- 동음이의어, 다른 분야 키워드는 제거\n- 실제로 같은 이슈를 다루는 키워드만 남기세요\n- 원본 키워드를 그대로 유지하세요 (수정하지 마세요)\n\n관련 있는 키워드만 JSON 배열로 응답하세요.\n["키워드1","키워드2"]';
      callLLM(prompt).then(function(t){
        if(relId!==_currentRelatedId)return; // stale AI response 무시
        try{
          var filtered=JSON.parse(t.replace(/```json|```/g,'').trim());
          if(!Array.isArray(filtered)||filtered.length===0)filtered=raw;
          renderRelated(rp,kw,filtered,'YouTube + AI 필터 · '+filtered.length+'개 (원본 '+raw.length+'개)');
        }catch(e){toast('AI 필터 파싱 실패 — YouTube 원본 표시','err');renderRelated(rp,kw,raw,'YouTube Suggest · '+raw.length+'개');}
      }).catch(function(e){toast('AI 필터 오류: '+(e&&e.message||'API 한도 초과')+'  — YouTube 원본 표시','err');renderRelated(rp,kw,raw,'YouTube Suggest · '+raw.length+'개');});
    }else{
      renderRelated(rp,kw,raw,'YouTube Suggest');
    }
  };
  // 이전 스크립트 정리
  var oldScript=document.querySelector('[id^="ytSuggestScript_"]');if(oldScript)oldScript.remove();
  var s=document.createElement('script');s.id='ytSuggestScript_'+relId;
  s.src='https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=ko&q='+encodeURIComponent(kw.label)+'&callback='+cbName;
  s.onerror=function(){window[cbName]([null,[]]);};
  document.head.appendChild(s);
}
function renderRelated(rp,kw,suggestions,source){
  rp.innerHTML='<div class="cd" style="border-color:var(--acc-ring);background:var(--acc-bg)"><div class="st" style="margin-bottom:12px;color:var(--acc)">🔗 "'+esc(kw.label)+'" 연관 키워드 <span style="font-size:11px;font-weight:400;color:var(--t3)">'+source+' · '+suggestions.length+'개</span></div><div style="display:flex;flex-wrap:wrap;gap:8px">'+suggestions.slice(0,12).map(function(r){return'<div class="tag" data-kwid="rel-'+esc(r)+'" data-relkw="'+esc(r)+'" style="padding:8px 14px;font-size:13px">'+esc(r)+'</div>';}).join('')+'</div></div>';
  rp.onclick=function(e){
    var t=e.target.closest('[data-relkw]');if(!t)return;
    t.classList.toggle('on');
    var selected=[kw];
    document.querySelectorAll('[data-relkw].on').forEach(function(x){selected.push({id:'rel-'+x.dataset.relkw,label:x.dataset.relkw,src:'연관',score:70,tags:[],period:'weekly'});});
    sSet({skw:selected});$('kc').textContent='선택: '+selected.length+'개';$('knxt').disabled=false;
  };
}


// ── Step 3: 영상 리스트 ──
window.ls3=function(){var p=$('p3');
  // 로그인 상태면 바로 영상 검색 (서버에서 YouTube API 호출)
  p.innerHTML='<button class="btn bs" onclick="sPrev()" style="margin-bottom:12px;font-size:12px">← 키워드 선택</button><h2 class="pt">영상 리스트</h2><p class="pd">잘팔린 컨텐츠를 점수순으로 정렬했습니다. 클릭하여 선택하세요.</p><div style="display:flex;gap:6px;margin-bottom:16px"><button class="tag on" data-days="7" onclick="filterDays(7)">7일</button><button class="tag" data-days="3" onclick="filterDays(3)">3일</button><button class="tag" data-days="1" onclick="filterDays(1)">1일</button><button class="tag" data-days="30" onclick="filterDays(30)">30일</button></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px"><button class="btn bs" style="font-size:11px" onclick="showManualUrlInput()">URL 직접 입력</button></div><div id="vl"></div>';
  filterDays(S._filterDays||7);
};

function showManualUrlInput(){
  var section=$('manualUrlSection');
  if(!section){
    // API 키 있는 경우 — vl 아래에 입력란 추가
    var vl=$('vl');
    if(vl)vl.insertAdjacentHTML('beforebegin','<div id="manualUrlSection"></div>');
    section=$('manualUrlSection');
  }
  if(!section)return;
  section.style.display='block';
  section.innerHTML='<div class="cd" style="border-color:var(--acc-ring)">'+
    '<div style="font-size:14px;font-weight:600;margin-bottom:12px">YouTube 영상 URL 입력</div>'+
    '<div style="font-size:12px;color:var(--t3);margin-bottom:12px;line-height:1.6">분석할 YouTube 영상의 URL을 붙여넣으세요</div>'+
    '<div style="display:flex;gap:8px"><input class="inp" id="manualUrl" placeholder="https://www.youtube.com/watch?v=..." style="flex:1;font-size:13px"><button class="btn bp" onclick="loadManualUrl()">분석하기</button></div>'+
    '<div id="manualUrlErr" style="color:var(--red);font-size:12px;margin-top:8px;display:none"></div>'+
  '</div>';
  setTimeout(function(){var inp=$('manualUrl');if(inp)inp.focus();},100);
}

function loadManualUrl(){
  var url=($('manualUrl')||{}).value||'';
  var errEl=$('manualUrlErr');
  // YouTube URL에서 videoId 추출
  var match=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if(!match){
    if(errEl){errEl.textContent='유효한 YouTube URL이 아닙니다';errEl.style.display='block';}
    return;
  }
  var videoId=match[1];
  if(errEl)errEl.style.display='none';
  toast('영상 정보를 불러오는 중...');

  // YouTube oEmbed API (키 불필요)로 기본 정보 가져오기
  fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v='+videoId+'&format=json')
    .then(function(r){
      if(!r.ok)throw new Error('영상을 찾을 수 없습니다');
      return r.json();
    })
    .then(function(data){
      var vid={
        id:videoId,
        title:data.title||'영상 '+videoId,
        ch:data.author_name||'',
        thumb:data.thumbnail_url||'https://i.ytimg.com/vi/'+videoId+'/hqdefault.jpg',
        date:new Date().toISOString().substring(0,10),
        views:0, likes:0, subs:0,
        desc:'', score:0, news:false
      };
      sSet({sv:vid,vids:[vid]});
      toast(vid.title);
      sSet({step:4,mx:Math.max(S.mx,4)});
      syncSb();showP();
    })
    .catch(function(e){
      if(errEl){errEl.textContent=e.message;errEl.style.display='block';}
    });
}


// ── Step 4: 영상 선택 확인 ──
window.ls4=function(){var v=S.sv;if(!v)return;var r=v.subs>0?(v.views/v.subs).toFixed(1):'-';$('p4').innerHTML='<h2 class="pt">영상 선택 확인</h2><p class="pd">이 영상을 분석하시겠습니까?</p><div class="cd" style="padding:28px"><h3 style="font-size:18px;font-weight:700;margin-bottom:8px;letter-spacing:-.3px">'+esc(v.title)+'</h3><div style="font-size:14px;color:var(--t2);margin-bottom:14px;font-weight:500">'+esc(v.ch)+' · '+v.date+'</div><div style="display:flex;gap:8px;flex-wrap:wrap"><span class="bdg bgy">▶ '+fmt(v.views)+'</span><span class="bdg bgy">구독 '+fmt(v.subs)+'</span><span class="bdg ba">점수 '+v.score+'</span><span class="bdg bgy">비율 '+r+'x</span></div></div><button class="btn bp btn-lg" style="margin-top:20px" id="s4b">영상 분석 시작 →</button>';$('s4b').onclick=function(){sNext();};};


// ── Step 5: 영상 분석 ──
window.ls5=function(){if(S.ana){rAna();return;}
  var isElec=window.electronAPI&&window.electronAPI.isElectron;
  if(isElec){
    // Electron: 자동 자막 추출
    $('p5').innerHTML='<div class="ld"><div class="sp"></div>자막을 추출하고 있습니다...<br><span style="font-size:12px;color:var(--t4)">Electron 직접 추출 중</span></div>';
    window.electronAPI.getSubtitle(S.sv.id).then(function(sub){
      var transcript=sub.text||'';
      if(transcript&&transcript.length>30){
        sSet({transcript:transcript});
        toast('자막 추출 완료 ('+sub.charCount+'자, '+sub.language+')');
        startAnalysis(transcript);
      }else{
        showSubtitleInput(sub.error||'자막을 찾을 수 없습니다');
      }
    }).catch(function(e){showSubtitleInput(e.message||'자막 추출 실패');});
  }else{
    // 웹: 바로 자막 입력 화면 표시
    showSubtitleInput();
  }
};
function showSubtitleInput(errorMsg){
  $('p5').innerHTML='<h2 class="pt">영상 분석</h2><div class="cd"><div style="font-size:14px;font-weight:600;color:var(--t1);margin-bottom:12px">'+(errorMsg?'자동 자막 추출 실패 — 직접 입력해주세요':'자막을 입력하면 더 정확한 분석이 가능합니다')+'</div>'+(errorMsg?'<div style="font-size:12px;color:var(--t3);margin-bottom:12px">'+esc(errorMsg)+'</div>':'')+'<div style="font-size:13px;color:var(--t2);margin-bottom:12px;line-height:1.6">YouTube 영상에서 자막을 복사해서 붙여넣어주세요.<br><span style="color:var(--t3)">영상 페이지 → 더보기(⋯) → 스크립트 보기 → 전체 복사</span></div><textarea class="inp" id="manualSub" rows="6" placeholder="여기에 자막/스크립트를 붙여넣으세요..." style="font-size:13px;line-height:1.6;resize:vertical"></textarea></div><div style="display:flex;gap:10px;margin-top:16px"><button class="btn bp btn-lg" id="s5sub">자막 포함 분석 시작 →</button><button class="btn bs btn-lg" id="s5skip" style="color:var(--t3)">자막 없이 분석</button></div>';
  $('s5sub').onclick=function(){
    var manual=$('manualSub').value.trim();
    if(!manual){toast('자막을 붙여넣어주세요','err');return;}
    sSet({transcript:manual});
    toast('수동 자막 입력 완료 ('+manual.length+'자)');
    startAnalysis(manual);
  };
  $('s5skip').onclick=function(){
    sSet({transcript:''});
    startAnalysis('');
  };
}
function startAnalysis(transcript){
  $('p5').innerHTML='<div class="ld"><div class="sp"></div><div style="font-size:15px;font-weight:600;color:var(--t1);margin-bottom:4px">AI 영상 분석</div><div class="ai-progress" id="anaProgress">'+
    '<div class="ai-step active" id="ana-s1"><span class="ai-step-dot"></span>'+(transcript?'자막 '+transcript.length+'자 분석 준비':'제목/설명 기반 분석 준비')+'</div>'+
    '<div class="ai-step" id="ana-s2"><span class="ai-step-dot"></span>영상 구조 파악</div>'+
    '<div class="ai-step" id="ana-s3"><span class="ai-step-dot"></span>훅 포인트 추출</div>'+
    '<div class="ai-step" id="ana-s4"><span class="ai-step-dot"></span>성공 요인 분석</div>'+
  '</div></div>';
  var anaSteps=['ana-s1','ana-s2','ana-s3','ana-s4'];var anaIdx=0;
  var anaTimer=setInterval(function(){if(anaIdx<anaSteps.length-1){var prev=document.getElementById(anaSteps[anaIdx]);if(prev){prev.className='ai-step done';}anaIdx++;var cur=document.getElementById(anaSteps[anaIdx]);if(cur){cur.className='ai-step active';}}},2500);
  withTimeout(Api.analyze(S.sv,transcript),60000,"AI 분석 시간이 초과되었습니다. 다시 시도해주세요.").then(function(r){clearInterval(anaTimer);anaSteps.forEach(function(id){var el=document.getElementById(id);if(el)el.className='ai-step done';});setTimeout(function(){sSet({ana:r});rAna();},400);}).catch(function(e){clearInterval(anaTimer);$('p5').innerHTML='<div class="cd" style="text-align:center;padding:32px"><div style="font-size:16px;font-weight:600;color:var(--red);margin-bottom:8px">분석 실패</div><div style="font-size:13px;color:var(--t2);margin-bottom:16px">'+esc(e.message)+'</div><button class="btn bp" onclick="sSet({ana:null});window.ls5()">다시 시도</button></div>';});
}
function rAna(){var a=S.ana;$('p5').innerHTML='<h2 class="pt">영상 분석 결과</h2><div class="cd"><div class="st">요약</div><p style="font-size:14px;line-height:1.9;color:var(--t2)">'+esc(a.summary)+'</p></div><div class="g2"><div class="cd"><div class="st">훅 포인트</div>'+a.hooks.map(function(h){return'<div style="display:flex;gap:10px;margin-bottom:10px"><div class="accent-line al-acc"></div><div style="font-size:13px;color:var(--t2);line-height:1.6">'+esc(h)+'</div></div>';}).join('')+'</div><div class="cd"><div class="st">잘된 이유</div>'+a.reasons.map(function(r){return'<div style="display:flex;gap:10px;margin-bottom:10px"><div class="accent-line al-grn"></div><div style="font-size:13px;color:var(--t2);line-height:1.6">'+esc(r)+'</div></div>';}).join('')+'</div></div><div class="cd"><div class="st">영상 구조</div>'+a.structure.map(function(s,i){return'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><span class="bdg bgy" style="min-width:26px;justify-content:center">'+(i+1)+'</span><span style="font-size:13px;color:var(--t2)">'+esc(s)+'</span></div>';}).join('')+'</div><button class="btn bp btn-lg" style="margin-top:20px" id="s5b">스크립트 생성하기 →</button>';$('s5b').onclick=function(){sNext();};}


// ── Step 6: 스크립트 생성 ──
window.ls6=function(){
  // 이미 대본이 있으면 바로 표시 (restoreScript 또는 뒤로 가기)
  if(S.scr){
    var styles=[];try{styles=JSON.parse(localStorage.getItem('yt_a_sty'));}catch(e){}
    if(!styles||!styles.length)styles=M.styles;
    styles=styles.filter(function(s){return s.on!==false;});
    var histHtml='';if(S.scriptHistory&&S.scriptHistory.length>1){histHtml='<div class="cd" style="margin-top:16px;border-style:dashed"><div class="st" style="margin-bottom:12px">이전 대본 ('+(S.scriptHistory.length-1)+'개)</div>'+S.scriptHistory.slice(0,-1).reverse().map(function(h,i){return'<div style="padding:10px;margin-bottom:8px;background:var(--bg);border-radius:var(--r);cursor:pointer" onclick="restoreScript('+i+')"><div style="font-size:13px;font-weight:600">'+esc(h.title)+'</div><div style="font-size:11px;color:var(--t3)">'+esc(h.style)+' · '+esc(h.time)+'</div></div>';}).join('')+'</div>';}
    $('p6').innerHTML='<button class="btn bs" onclick="sPrev()" style="margin-bottom:12px;font-size:12px">← 영상 분석</button><h2 class="pt">스크립트 생성</h2><p class="pd">스타일을 선택하고 대본을 생성하세요</p><div style="display:flex;gap:10px;margin-bottom:24px"><select class="inp" id="ssel" style="width:260px">'+styles.map(function(s){return'<option value="'+s.id+'" data-prompt="'+esc(s.prompt||'')+'">'+esc(s.name)+' — '+esc(s.desc)+'</option>';}).join('')+'</select><button class="btn bp" id="gbtn">다시 생성</button></div><div id="sout"><div class="cd"><div class="cdh"><div class="st" style="margin:0;font-size:16px">'+esc(S.scr.title)+'</div><button class="btn bs" style="font-size:12px" onclick="navigator.clipboard.writeText(S.scr.content);toast(\'복사됨\')">복사</button></div><div class="out">'+esc(S.es||S.scr.content)+'</div></div><button class="btn bp btn-lg" style="margin-top:20px" id="s6b">팩트 검증 →</button>'+histHtml+'</div>';
    $('s6b').onclick=function(){sNext();};
    $('gbtn').onclick=function(){sSet({scr:null,es:''});window.ls6();};
    return;
  }
  // 대본이 없으면 생성 UI
  var styles=[];try{styles=JSON.parse(localStorage.getItem('yt_a_sty'));}catch(e){}
  if(!styles||!styles.length)styles=M.styles;
  styles=styles.filter(function(s){return s.on!==false;});
  $('p6').innerHTML='<button class="btn bs" onclick="sPrev()" style="margin-bottom:12px;font-size:12px">← 영상 분석</button><h2 class="pt">스크립트 생성</h2><p class="pd">스타일을 선택하고 대본을 생성하세요</p><div style="display:flex;gap:10px;margin-bottom:24px"><select class="inp" id="ssel" style="width:260px">'+styles.map(function(s){return'<option value="'+s.id+'" data-prompt="'+esc(s.prompt||'')+'">'+esc(s.name)+' — '+esc(s.desc)+'</option>';}).join('')+'</select><button class="btn bp" id="gbtn">대본 생성</button></div><div id="sout"></div>';
  $('gbtn').onclick=function(){
    var b=$('gbtn');b.disabled=true;b.textContent='생성 중...';
    var opt=$('ssel').options[$('ssel').selectedIndex];
    var styName=opt.text.split(' —')[0];
    var styPrompt=opt.getAttribute('data-prompt')||'';
    $('sout').innerHTML='<div class="ld" style="padding:40px"><div class="sp"></div><div style="font-size:15px;font-weight:600;color:var(--t1);margin-bottom:4px">AI 대본 작성</div><div class="ai-progress" id="scrProgress">'+
      '<div class="ai-step active" id="scr-s1"><span class="ai-step-dot"></span>분석 결과 반영</div>'+
      '<div class="ai-step" id="scr-s2"><span class="ai-step-dot"></span>훅 문장 구성</div>'+
      '<div class="ai-step" id="scr-s3"><span class="ai-step-dot"></span>대본 작성 중</div>'+
    '</div></div>';
    var scrSteps=['scr-s1','scr-s2','scr-s3'];var scrIdx=0;
    var scrTimer=setInterval(function(){if(scrIdx<scrSteps.length-1){var prev=document.getElementById(scrSteps[scrIdx]);if(prev)prev.className='ai-step done';scrIdx++;var cur=document.getElementById(scrSteps[scrIdx]);if(cur)cur.className='ai-step active';}},3000);
    withTimeout(Api.genScript(S.ana,styName,styPrompt),60000,"대본 생성 시간이 초과되었습니다. 다시 시도해주세요.").then(function(r){
      clearInterval(scrTimer);scrSteps.forEach(function(id){var el=document.getElementById(id);if(el)el.className='ai-step done';});
      var hist=S.scriptHistory||[];hist.push({title:r.title,content:r.content,time:new Date().toLocaleTimeString('ko'),style:styName});sSet({scr:r,es:r.content,scriptHistory:hist});b.disabled=false;b.textContent='다시 생성';
      var histHtml='';if(S.scriptHistory&&S.scriptHistory.length>1){histHtml='<div class="cd" style="margin-top:16px;border-style:dashed"><div class="st" style="margin-bottom:12px">이전 대본 ('+(S.scriptHistory.length-1)+'개)</div>'+S.scriptHistory.slice(0,-1).reverse().map(function(h,i){return'<div style="padding:10px;margin-bottom:8px;background:var(--bg);border-radius:var(--r);cursor:pointer" onclick="restoreScript('+i+')"><div style="font-size:13px;font-weight:600">'+esc(h.title)+'</div><div style="font-size:11px;color:var(--t3)">'+esc(h.style)+' · '+esc(h.time)+'</div></div>';}).join('')+'</div>';}$('sout').innerHTML='<div class="cd"><div class="cdh"><div class="st" style="margin:0;font-size:16px">'+esc(r.title)+'</div><button class="btn bs" style="font-size:12px" onclick="navigator.clipboard.writeText(S.scr.content);toast(\'복사됨\')">복사</button></div><div class="out">'+esc(r.content)+'</div></div><button class="btn bp btn-lg" style="margin-top:20px" id="s6b">팩트 검증 →</button>'+histHtml;
      $('s6b').onclick=function(){sNext();};
    }).catch(function(e){
      clearInterval(scrTimer);b.disabled=false;b.textContent='대본 생성';
      $('sout').innerHTML='<div class="cd" style="text-align:center;padding:32px"><div style="font-size:16px;font-weight:600;color:var(--red);margin-bottom:8px">대본 생성 실패</div><div style="font-size:13px;color:var(--t2);margin-bottom:16px">'+esc(e.message)+'</div><button class="btn bp" onclick="sSet({scr:null});window.ls6()">다시 시도</button></div>';
    });
  };
};


// ── Step 7: 팩트 검증 ──
window.ls7=function(){if(S.fcs.length){rFC();return;}$('p7').innerHTML='<div class="ld"><div class="sp"></div><div style="font-size:15px;font-weight:600;color:var(--t1);margin-bottom:4px">팩트 검증</div><div class="ai-progress"><div class="ai-step active"><span class="ai-step-dot"></span>대본 문장 분석 중</div><div class="ai-step"><span class="ai-step-dot"></span>사실 여부 판별</div></div></div>';withTimeout(Api.factCheck(S.scr?S.scr.content:''),45000,'팩트 검증 시간이 초과되었습니다. 다시 시도해주세요.').then(function(r){sSet({fcs:r});rFC();}).catch(function(e){$('p7').innerHTML='<div class="cd" style="text-align:center;padding:32px"><div style="font-size:16px;font-weight:600;color:var(--red);margin-bottom:8px">팩트 검증 실패</div><div style="font-size:13px;color:var(--t2);margin-bottom:16px">'+esc(e.message)+'</div><div style="display:flex;gap:10px;justify-content:center"><button class="btn bp" onclick="sSet({fcs:[]});window.ls7()">다시 시도</button><button class="btn bs" onclick="sSet({fcs:[]});sNext()">건너뛰기 →</button></div></div>';});};
function rFC(){var items=S.fcs;var co={safe:'var(--grn)',warning:'var(--yel)',uncertain:'var(--red)'};var lb={safe:'안전',warning:'주의',uncertain:'미확인'};var bc={safe:'bg2',warning:'by',uncertain:'br'};$('p7').innerHTML='<h2 class="pt">팩트 검증 & 스크립트 수정</h2><p class="pd">허위사실로 판단되는 문장을 삭제하면 아래 스크립트에서도 자동으로 제거됩니다</p><div style="padding:12px 16px;background:rgba(234,179,8,.08);border:1px solid rgba(234,179,8,.2);border-radius:var(--r2);margin-bottom:16px;display:flex;align-items:flex-start;gap:10px"><span style="font-size:16px;flex-shrink:0">💡</span><div style="font-size:13px;color:var(--t2);line-height:1.6"><strong>AI 기반 팩트 검증</strong><br>AI가 대본 내용을 분석하여 사실 확인이 필요한 문장을 표시합니다. 다만 실제 사실과 다를 수 있으니, 중요한 수치·사건·인물은 반드시 직접 확인하세요.</div></div><div class="cd" id="fcl">'+items.map(function(f){return'<div class="fcr" data-id="'+f.id+'"><div><div style="font-size:14px;line-height:1.6;font-weight:500">'+esc(f.text)+'</div><div style="font-size:12px;color:var(--t3);margin-top:3px">'+esc(f.note)+'</div></div><span class="bdg '+bc[f.st]+'">'+lb[f.st]+'</span><button class="btn bg" style="color:var(--red);font-size:12px;padding:4px 8px" data-rm="'+f.id+'">삭제</button></div>';}).join('')+'</div><div class="cd" style="margin-top:16px"><div class="cdh"><div class="st" style="margin:0">스크립트 수정</div><span id="scriptDiff" style="font-size:11px;color:var(--t3)"></span></div><textarea class="inp" id="ea">'+esc(S.es||S.scr.content)+'</textarea></div><button class="btn bp btn-lg" style="margin-top:20px" id="s7b">풋티지 브리프 →</button>';$('fcl').onclick=function(e){var b=e.target.closest('[data-rm]');if(!b)return;var id=b.dataset.rm;var fc=S.fcs.find(function(f){return f.id===id;});if(fc){var ea=$('ea');var txt=ea.value;var sentence=fc.text.trim();var lines=txt.split('\n');var removed=false;var newLines=lines.filter(function(line){var lt=line.trim();if(!removed&&lt===sentence){removed=true;return false;}if(!removed&&lt.length>10&&sentence.length>10&&lt===sentence){removed=true;return false;}return true;});if(!removed){newLines=lines.filter(function(line){var lt=line.trim();if(!removed&&lt.length>10&&sentence.length>10&&lt.indexOf(sentence)===0){removed=true;return false;}return true;});}var newTxt=newLines.join('\n').replace(/\n{3,}/g,'\n\n');ea.value=newTxt;sSet({es:newTxt});$('scriptDiff').textContent=removed?'✓ "'+sentence.substring(0,20)+'..." 삭제됨':'해당 문장을 스크립트에서 찾을 수 없습니다';$('scriptDiff').style.color=removed?'var(--red)':'var(--t3)';setTimeout(function(){$('scriptDiff').textContent='';},3000);}sSet({fcs:S.fcs.filter(function(f){return f.id!==id;})});var r=$('fcl').querySelector('[data-id="'+id+'"]');if(r){r.style.opacity='0';r.style.transform='translateX(20px)';r.style.transition='all .3s';setTimeout(function(){r.remove();},300);}};$('ea').oninput=function(){sSet({es:$('ea').value});};$('s7b').onclick=function(){sNext();};}


// ── Step 8: 풋티지 브리프 ──
window.ls8=function(){if(S.ekw.length){rEK();return;}$('p8').innerHTML='<div class="ld"><div class="sp"></div><div style="font-size:15px;font-weight:600;color:var(--t1);margin-bottom:4px">풋티지 브리프 생성</div><div class="ai-progress"><div class="ai-step active"><span class="ai-step-dot"></span>대본을 장면 단위로 분석 중</div><div class="ai-step"><span class="ai-step-dot"></span>장면별 검색어 생성</div></div></div>';withTimeout(Api.extractKw(S.es||S.scr&&S.scr.content||''),45000,'풋티지 브리프 생성 시간이 초과되었습니다. 다시 시도해주세요.').then(function(r){sSet({ekw:r});rEK();}).catch(function(e){$('p8').innerHTML='<div class="cd" style="text-align:center;padding:32px"><div style="font-size:16px;font-weight:600;color:var(--red);margin-bottom:8px">풋티지 브리프 생성 실패</div><div style="font-size:13px;color:var(--t2);margin-bottom:16px">'+esc(e.message)+'</div><div style="display:flex;gap:10px;justify-content:center"><button class="btn bp" onclick="sSet({ekw:[]});window.ls8()">다시 시도</button><button class="btn bs" onclick="sSet({ekw:[]});sNext()">건너뛰기 →</button></div></div>';});};
function rEK(){
  var scenes=S.ekw;
  var sbUrl=function(q){return'https://www.storyblocks.com/video/search/'+encodeURIComponent(q);};
  // 신규 장면 카드 형식인지 확인 (scene 필드 있으면 신규)
  if(scenes.length>0&&scenes[0].scene){
    var labelColors={후킹:'#DC2626',사건설명:'#2563EB',인물소개:'#7C3AED',배경설명:'#059669',핵심주장:'#D97706',숫자강조:'#0891B2',긴장감:'#DC2626',전환:'#6B7280',마무리:'#059669'};
    var allKw=scenes.map(function(s){return s.mainEn;}).join(' ');
    $('p8').innerHTML='<h2 class="pt">풋티지 브리프</h2><p class="pd">장면별로 찾아야 할 소스를 정리했습니다. 검색 버튼을 눌러 Storyblocks에서 찾으세요.</p>'+
      '<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">'+
        '<a href="'+sbUrl(allKw)+'" target="_blank" rel="noopener" class="btn bp" style="text-decoration:none;gap:6px">🔍 전체 Storyblocks 검색</a>'+
        '<button class="btn bs" onclick="var t=S.ekw.map(function(s,i){return(i+1)+\'. \'+s.label+\': \'+s.mainEn+\' / \'+(s.altEn||[]).join(\', \');}).join(\'\\n\');navigator.clipboard.writeText(t);toast(\'전체 검색어 복사됨\')">📋 전체 검색어 복사</button>'+
        '<button class="btn bs" onclick="sSet({ekw:[]});window.ls8()">🔄 다시 생성</button>'+
      '</div>'+
      '<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">'+
        '<span class="bdg bg2" style="font-size:12px">총 '+scenes.length+'개 장면</span>'+
        '<span class="bdg" style="font-size:12px;background:rgba(37,99,235,.1);color:#2563EB">Storyblocks 검색 권장</span>'+
      '</div>'+
      scenes.map(function(s,i){
        var color=labelColors[s.label]||'#6B7280';
        return'<div class="cd" style="margin-bottom:14px;border-left:4px solid '+color+'">'+
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'+
            '<div style="width:32px;height:32px;border-radius:8px;background:'+color+'15;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:700;color:'+color+'">'+(i+1)+'</div>'+
            '<div style="flex:1"><span style="font-size:13px;font-weight:700;color:'+color+'">'+esc(s.label)+'</span><span style="font-size:12px;color:var(--t3);margin-left:8px">'+esc(s.cut||'')+'</span></div>'+
            '<a href="'+sbUrl(s.mainEn)+'" target="_blank" rel="noopener" class="btn bp" style="font-size:12px;padding:6px 14px;text-decoration:none">🔍 검색</a>'+
          '</div>'+
          '<div style="font-size:14px;color:var(--t1);line-height:1.6;margin-bottom:10px;padding:10px 14px;background:var(--bg);border-radius:var(--r);font-style:italic">"'+esc(s.text)+'"</div>'+
          '<div style="font-size:13px;color:var(--t2);margin-bottom:10px">'+esc(s.purpose)+'</div>'+
          '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
            '<a href="'+sbUrl(s.mainEn)+'" target="_blank" rel="noopener" class="tag on" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;font-weight:600">'+esc(s.mainEn)+' <span style="font-size:10px;opacity:.6">↗</span></a>'+
            (s.altEn||[]).map(function(alt){return'<a href="'+sbUrl(alt)+'" target="_blank" rel="noopener" class="tag" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px">'+esc(alt)+' <span style="font-size:10px;opacity:.6">↗</span></a>';}).join('')+
            (s.ko?'<span class="tag" style="background:var(--bg2);color:var(--t2)">'+esc(s.ko)+'</span>':'')+
          '</div>'+
        '</div>';
      }).join('')+
      '<button class="btn bp btn-lg" style="margin-top:20px" id="s8b">썸네일 문구 →</button>';
    $('s8b').onclick=function(){sNext();};
  } else {
    // fallback: 기존 키워드 카테고리 형식 (하위 호환)
    var cats={topic:'주제',search:'검색용',emotion:'감정',visual:'비주얼 (풋티지)'};var gr={};scenes.forEach(function(k){if(!gr[k.c])gr[k.c]=[];gr[k.c].push(k);});
    $('p8').innerHTML='<h2 class="pt">풋티지 브리프</h2><p class="pd">대본에서 추출된 키워드입니다. 클릭하면 Storyblocks에서 검색합니다.</p>'+Object.keys(gr).map(function(c){var enAll=gr[c].map(function(k){return k.en||k.v;}).join(' ');return'<div class="cd"><div class="cdh"><div class="st" style="margin:0">'+(cats[c]||c)+'</div><a href="'+sbUrl(enAll)+'" target="_blank" rel="noopener" style="font-size:12px;color:var(--acc);text-decoration:none;font-weight:600">Storyblocks에서 전체 검색 →</a></div><div style="display:flex;gap:6px;flex-wrap:wrap">'+gr[c].map(function(k){var enTerm=k.en||k.v;return'<a href="'+sbUrl(enTerm)+'" target="_blank" rel="noopener" class="tag on" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px">'+esc(k.v)+(k.en?'<span style="font-size:10px;opacity:.5;font-style:italic">'+esc(k.en)+'</span>':'')+'<span style="font-size:10px;opacity:.6">↗</span></a>';}).join('')+'</div></div>';}).join('')+'<button class="btn bp btn-lg" style="margin-top:20px" id="s8b">썸네일 문구 →</button>';
    $('s8b').onclick=function(){sNext();};
  }
}


// ── Step 9: 썸네일 문구 ──
window.ls9=function(){
  if(S.thumbs&&S.thumbs.length){renderThumbStep();return;}
  $('p9').innerHTML='<div class="ld"><div class="sp"></div><div style="font-size:15px;font-weight:600;color:var(--t1);margin-bottom:4px">썸네일 문구 생성</div><div class="ai-progress"><div class="ai-step active"><span class="ai-step-dot"></span>대본 분석 중</div><div class="ai-step"><span class="ai-step-dot"></span>클릭 유발 문구 생성</div></div></div>';
  var sc=S.scr||{};var txt=S.es||sc.content||'';
  withTimeout(Api.genThumb(sc.title||'',txt),30000,'썸네일 문구 생성 시간이 초과되었습니다. 다시 시도해주세요.').then(function(thumbs){
    sSet({thumbs:thumbs});renderThumbStep();
  }).catch(function(e){
    $('p9').innerHTML='<div class="cd" style="text-align:center;padding:32px"><div style="font-size:16px;font-weight:600;color:var(--red);margin-bottom:8px">썸네일 문구 생성 실패</div><div style="font-size:13px;color:var(--t2);margin-bottom:16px">'+esc(e.message)+'</div><div style="display:flex;gap:10px;justify-content:center"><button class="btn bp" onclick="sSet({thumbs:null});window.ls9()">다시 시도</button><button class="btn bs" onclick="sSet({thumbs:[]});sNext()">건너뛰기 →</button></div></div>';
  });
};
function renderThumbStep(){
  var thumbs=S.thumbs||[];
  $('p9').innerHTML='<h2 class="pt">썸네일 문구</h2><p class="pd">AI가 추천하는 썸네일 문구입니다. 클릭하면 복사됩니다.</p>'+
    '<div class="cd" style="border-color:#8B5CF6;border-width:1.5px">'+
    '<div class="cdh"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">🎯</span><div class="st" style="margin:0;color:#8B5CF6">추천 문구</div></div>'+
    '<button class="btn bs" style="font-size:12px" id="thumbRegen">다시 생성</button></div>'+
    '<div id="thumbList">'+thumbs.map(function(t,i){
      return'<div style="display:flex;align-items:center;gap:14px;padding:16px 18px;margin-bottom:10px;background:var(--bg);border-radius:var(--r2);border:1.5px solid var(--bdr);cursor:pointer;transition:all .2s" onclick="navigator.clipboard.writeText(\''+esc(t).replace(/'/g,"\\'")+'\');toast(\'복사됨: '+esc(t).replace(/'/g,"\\'").substring(0,15)+'...\')" onmouseover="this.style.borderColor=\'#8B5CF6\';this.style.background=\'rgba(139,92,246,.04)\'" onmouseout="this.style.borderColor=\'var(--bdr)\';this.style.background=\'var(--bg)\'">'+
        '<div style="width:36px;height:36px;border-radius:10px;background:rgba(139,92,246,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;font-weight:700;color:#8B5CF6">'+(i+1)+'</div>'+
        '<div style="flex:1;font-size:16px;font-weight:700;color:var(--t1);line-height:1.5">'+esc(t)+'</div>'+
        '<span style="font-size:12px;color:var(--t4);flex-shrink:0;white-space:nowrap">클릭하여 복사</span>'+
      '</div>';
    }).join('')+'</div>'+
    '</div>'+
    '<div style="margin-top:16px;padding:14px 16px;background:var(--bg1);border-radius:var(--r2);font-size:13px;color:var(--t3);line-height:1.6">💡 <strong>팁:</strong> 썸네일 문구는 15자 이내가 가장 효과적입니다. 문구를 복사해서 썸네일 편집 프로그램에 바로 붙여넣으세요.</div>'+
    '<button class="btn bp btn-lg" style="margin-top:20px" id="s9b">음성 생성 →</button>';
  $('s9b').onclick=function(){sNext();};
  $('thumbRegen').onclick=function(){sSet({thumbs:null});window.ls9();};
}


// ── Step 10: 음성 생성 ──
window.ls10=function(){
  if(S.vdone){rV();return;}
  var voices=M.voices;var selId=S.selVoice||'vc4';
  var googleVoices=voices.filter(function(v){return v.provider==='google';});
  var elVoices=voices.filter(function(v){return v.provider==='elevenlabs';});
  $('p10').innerHTML='<h2 class="pt">음성 생성</h2><p class="pd">AI 음성을 선택하거나 내 목소리를 업로드하세요</p>'+
    '<div class="cd"><div class="st" style="display:flex;align-items:center;gap:8px">기본 AI 음성<span class="bdg" style="font-size:10px;background:rgba(34,197,94,.1);color:#22C55E">무료</span></div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">'+
    googleVoices.map(function(v){
      var on=v.id===selId;
      return'<div class="tag'+(on?' on':'')+'" data-vid="'+v.id+'" style="padding:10px 18px;font-size:13px;display:inline-flex;flex-direction:column;align-items:center;gap:4px;min-width:72px;cursor:pointer">'+
        '<div style="width:36px;height:36px;border-radius:50%;background:'+(on?'var(--acc-bg2)':'var(--bg2)')+';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:'+(on?'var(--acc)':'var(--t3)')+';transition:all .2s">AI</div>'+
        '<span style="font-weight:600">'+esc(v.name)+'</span>'+
      '</div>';
    }).join('')+
    '</div>'+
    '<div style="border-top:1px solid var(--bdr);padding-top:16px;margin-top:4px"><div class="st" style="display:flex;align-items:center;gap:8px">프리미엄 AI 음성<span class="bdg" style="font-size:10px;background:rgba(139,92,246,.1);color:#8B5CF6">ElevenLabs</span></div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">'+
    elVoices.map(function(v){
      var on=v.id===selId;
      return'<div class="tag'+(on?' on':'')+'" data-vid="'+v.id+'" style="padding:10px 18px;font-size:13px;display:inline-flex;flex-direction:column;align-items:center;gap:4px;min-width:72px;cursor:pointer;border-color:'+(on?'#8B5CF6':'')+'">'+
        '<div style="width:36px;height:36px;border-radius:50%;background:'+(on?'rgba(139,92,246,.15)':'var(--bg2)')+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:'+(on?'#8B5CF6':'var(--t3)')+';transition:all .2s">PRO</div>'+
        '<span style="font-weight:600">'+esc(v.name)+'</span>'+
      '</div>';
    }).join('')+
    '</div></div>'+
    '<div id="voicePreview" style="margin-bottom:20px"></div>'+
    '<div style="border-top:1px solid var(--bdr);padding-top:20px;margin-top:4px"><div class="st" style="display:flex;align-items:center;gap:8px">내 목소리 사용<span class="bdg" style="font-size:10px;background:rgba(139,92,246,.1);color:#8B5CF6">ElevenLabs</span></div>'+
    '<div style="display:flex;gap:10px;align-items:center">'+
    '<label style="display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:var(--r2);border:1.5px dashed var(--bdr2);cursor:pointer;color:var(--t2);font-size:13px;font-weight:500;transition:all .2s;background:var(--bg)" onmouseover="this.style.borderColor=\'var(--acc)\';this.style.color=\'var(--acc)\'" onmouseout="this.style.borderColor=\'var(--bdr2)\';this.style.color=\'var(--t2)\'">'+
    '<span style="font-size:18px">🎤</span> 음성 파일 업로드 (.mp3, .wav)'+
    '<input type="file" accept=".mp3,.wav" style="display:none" onchange="handleVoiceUpload(this)">'+
    '</label>'+
    '<span id="uploadStatus" style="font-size:12px;color:var(--t3)"></span>'+
    '</div>'+
    '<p style="font-size:11px;color:var(--t4);margin-top:8px">내 목소리 샘플을 업로드하면 AI가 학습하여 유사한 음성을 생성합니다 (ElevenLabs)</p>'+
    '</div></div>'+
    '<button class="btn bp btn-lg" style="margin-top:20px" id="s10gen">선택한 음성으로 생성 →</button>';
  renderVoicePreview(selId);
  // Voice selection
  $('p10').querySelector('.cd').onclick=function(e){
    var t=e.target.closest('[data-vid]');if(!t)return;
    var vid=t.dataset.vid;var isEl=vid.indexOf('el')===0;
    document.querySelectorAll('[data-vid]').forEach(function(x){
      x.classList.remove('on');x.style.borderColor='';
      var dot=x.querySelector('div');dot.style.background='var(--bg2)';dot.style.color='var(--t3)';dot.textContent=x.dataset.vid.indexOf('el')===0?'PRO':'AI';
    });
    t.classList.add('on');t.style.borderColor=isEl?'#8B5CF6':'';
    var dot=t.querySelector('div');dot.style.background=isEl?'rgba(139,92,246,.15)':'var(--acc-bg2)';dot.style.color=isEl?'#8B5CF6':'var(--acc)';
    sSet({selVoice:vid});
    renderVoicePreview(vid);
  };
  $('s10gen').onclick=function(){
    var b=$('s10gen');b.disabled=true;b.textContent='음성 생성 중...';
    $('voicePreview').innerHTML='<div class="ld" style="padding:24px"><div class="sp"></div><div style="font-size:14px;font-weight:600;color:var(--t1)">AI 음성 생성 중</div><div class="ai-progress"><div class="ai-step active"><span class="ai-step-dot"></span>텍스트 → 음성 변환</div></div></div>';
    var script=S.es||S.scr&&S.scr.content||'';
    withTimeout(Api.genVoice(script,S.selVoice),60000,'음성 생성 시간이 초과되었습니다. 다시 시도해주세요.').then(function(result){
      sSet({vdone:true,voiceResult:result});rV();
    }).catch(function(e){
      b.disabled=false;b.textContent='선택한 음성으로 생성 →';
      $('voicePreview').innerHTML='<div style="padding:16px;background:#FFF5F5;border:1px solid rgba(220,38,38,.15);border-radius:var(--r2)"><div style="font-size:14px;font-weight:600;color:var(--red);margin-bottom:4px">음성 생성 실패</div><div style="font-size:12px;color:var(--t3)">'+esc(e.message)+'</div></div>';
    });
  };
};
function renderVoicePreview(vid){
  var v=M.voices.find(function(x){return x.id===vid;});if(!v)return;
  var isEl=v.provider==='elevenlabs';
  var googleMap={'vc1':'ko-KR-Neural2-C','vc2':'ko-KR-Neural2-A','vc3':'ko-KR-Neural2-C','vc4':'ko-KR-Neural2-B','vc5':'ko-KR-Wavenet-A','vc6':'ko-KR-Wavenet-C','vc7':'ko-KR-Wavenet-B','vc8':'ko-KR-Wavenet-D','vc9':'ko-KR-Wavenet-C'};
  var previewVoice=isEl?v.elId:googleMap[vid]||'ko-KR-Neural2-B';
  var providerLabel=isEl?'ElevenLabs':'Google TTS';
  var accentColor=isEl?'#8B5CF6':'var(--acc)';
  $('voicePreview').innerHTML=
    '<div style="display:flex;align-items:center;gap:16px;padding:16px;background:var(--bg);border:1px solid '+(isEl?'rgba(139,92,246,.3)':'var(--bdr)')+';border-radius:var(--r2)">'+
    '<div style="width:44px;height:44px;border-radius:50%;background:'+(isEl?'rgba(139,92,246,.15)':'var(--acc-bg2)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="font-size:'+(isEl?'10':'12')+'px;font-weight:700;color:'+accentColor+'">'+(isEl?'PRO':'AI')+'</span></div>'+
    '<div style="flex:1"><div style="font-size:14px;font-weight:600">'+esc(v.name)+'<span style="font-size:12px;color:var(--t3);font-weight:400;margin-left:8px">'+esc(v.gender==='남'?'남성':'여성')+' · '+esc(v.desc)+'</span><span class="bdg" style="font-size:9px;margin-left:6px;background:'+(isEl?'rgba(139,92,246,.1)':'rgba(34,197,94,.1)')+';color:'+(isEl?'#8B5CF6':'#22C55E')+'">'+providerLabel+'</span></div>'+
    '<div style="margin-top:8px;display:flex;align-items:center;gap:10px">'+
    '<div id="vpBtn" data-voice="'+esc(previewVoice)+'" data-provider="'+(isEl?'elevenlabs':'google')+'" style="width:28px;height:28px;border-radius:50%;background:'+accentColor+';display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0" onclick="playVoicePreview(this)"><span style="color:#fff;font-size:10px">▶</span></div>'+
    '<div id="vpWave" style="flex:1;height:24px;display:flex;align-items:center;gap:2px">'+
    Array.from({length:30},function(_,i){var h=6+Math.random()*14;return'<div style="width:3px;height:'+h+'px;background:var(--bg3);border-radius:1px;transition:background .2s"></div>';}).join('')+
    '</div>'+
    '<span id="vpTime" style="font-family:var(--mono);font-size:11px;color:var(--t3)">미리듣기</span>'+
    '</div></div></div>';
}
// playVoicePreview, handleVoiceUpload → client-proxy.js에서 프록시 버전으로 제공
function rV(){var r=S.voiceResult||M.voice;var dur=r.dur||0;var mn=Math.floor(dur/60);var sc=dur%60;var sv=M.voices.find(function(v){return v.id===S.selVoice;})||{name:S.selVoice==='custom'?'내 목소리':'알 수 없음',desc:''};var provider=r.provider||'AI TTS';$('p10').innerHTML='<h2 class="pt">음성 생성 완료</h2><div class="cd"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><div style="font-size:15px;font-weight:700">'+esc(sv.name)+(sv.desc?' <span style="font-size:12px;color:var(--t3);font-weight:400">'+esc(sv.desc)+'</span>':'')+'</div><div style="font-size:13px;color:var(--t3);margin-top:2px">'+esc(provider)+(r.voiceName?' · '+esc(r.voiceName):'')+'</div></div><span class="bdg bg2" style="font-size:12px;padding:4px 14px">생성 완료</span></div>'+(r.url?'<audio id="ttsAudio" src="'+r.url+'" preload="auto"></audio><div style="display:flex;align-items:center;gap:12px"><button id="ttsPlay" class="aub" style="width:36px;height:36px;border-radius:50%;background:var(--acc);border:none;color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center">▶</button><div style="flex:1;height:4px;background:var(--bg3);border-radius:2px;position:relative"><div id="ttsProgress" style="height:100%;background:var(--acc);border-radius:2px;width:0%;transition:width .1s"></div></div><span id="ttsTime" style="font-family:var(--mono);font-size:12px;color:var(--t3)">0:00</span></div>':'<div class="au"><button class="aub">▶</button><div class="abar"><div class="afil"></div></div><span style="font-family:var(--mono);font-size:13px;color:var(--t3)">'+mn+':'+String(sc).padStart(2,'0')+'</span></div>')+(r.blob?'<div style="margin-top:12px"><a id="ttsDownload" style="font-size:12px;color:var(--acc);cursor:pointer;text-decoration:none;font-weight:500">💾 음성 파일 다운로드 (.mp3)</a></div>':'')+'</div><button class="btn bp btn-lg" style="margin-top:20px" id="s10b">최종 결과 확인 →</button>';
  if(r.url){
    var audio=$('ttsAudio');var playing=false;
    $('ttsPlay').onclick=function(){if(playing){audio.pause();this.textContent='▶';}else{audio.play();this.textContent='⏸';}playing=!playing;};
    audio.ontimeupdate=function(){var pct=audio.currentTime/audio.duration*100;$('ttsProgress').style.width=pct+'%';var m=Math.floor(audio.currentTime/60);var s=Math.floor(audio.currentTime%60);$('ttsTime').textContent=m+':'+String(s).padStart(2,'0');};
    audio.onended=function(){$('ttsPlay').textContent='▶';playing=false;$('ttsProgress').style.width='0%';};
  }
  if(r.blob){$('ttsDownload').onclick=function(){var a=document.createElement('a');a.href=r.url;a.download='voice_'+Date.now()+'.mp3';a.click();};}
  $('s10b').onclick=function(){sNext();};
}


// ── Step 11: 결과 확인 ──
window.ls11=function(){var v=S.sv||{};var sc=S.scr||{};var txt=S.es||sc.content||'';var r=S.voiceResult||M.voice;var mn=Math.floor((r.dur||0)/60);var se=(r.dur||0)%60;
var scriptSize=new Blob([txt]).size;var anaSize=new Blob([JSON.stringify(S.ana||{},null,2)]).size;
var kwTxt=S.ekw[0]&&S.ekw[0].scene?S.ekw.map(function(s){return'[장면 '+s.scene+'] '+s.label+'\n대사: '+s.text+'\n목적: '+s.purpose+'\n검색어: '+s.mainEn+' / '+(s.altEn||[]).join(', ')+'\n한글: '+(s.ko||'')+'\n컷 길이: '+(s.cut||'')+'\nStoryblocks: https://www.storyblocks.com/video/search/'+encodeURIComponent(s.mainEn);}).join('\n\n'):S.ekw.map(function(k){return k.v+(k.en?' → '+k.en:'');}).join('\n');var kwSize=new Blob([kwTxt]).size;
var metaJson=JSON.stringify({title:sc.title||'',originalVideo:{title:v.title,channel:v.ch,views:v.views,score:v.score},style:S.sty,createdAt:new Date().toISOString()},null,2);var metaSize=new Blob([metaJson]).size;
var totalSize=scriptSize+anaSize+kwSize+metaSize+(S.voiceResult&&S.voiceResult.blob?S.voiceResult.blob.size:0);
var wordCount=txt.replace(/\n/g,' ').split(/\s+/).filter(Boolean).length;
var charCount=txt.length;
var readSec=Math.round(charCount/6);
var readMin=Math.floor(readSec/60);var readSecR=readSec%60;

$('p11').innerHTML=
  // 헤더
  '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:16px">'+
    '<div style="display:flex;align-items:center;gap:14px">'+
      '<div class="celebrate-icon" style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,var(--grn),#2ecc71);display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;box-shadow:0 4px 16px rgba(13,146,84,.25)">✓</div>'+
      '<div><h2 class="pt" style="margin:0">제작 완료</h2><p style="font-size:13px;color:var(--t3);margin:4px 0 0">'+new Date().toLocaleDateString('ko',{month:'long',day:'numeric',weekday:'short'})+' 제작</p></div>'+
    '</div>'+
    '<div style="display:flex;gap:8px">'+
      '<button class="btn bp btn-lg" onclick="downloadPkg()" style="gap:6px">📦 패키지 다운로드 <span style="font-size:11px;opacity:.7">('+fmtB(totalSize)+')</span></button>'+
      '<button class="btn bs" onclick="doLogout()">새 프로젝트</button>'+
    '</div>'+
  '</div>'+

  // 통계 요약
  '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:24px">'+
    '<div style="background:var(--white);border:1px solid var(--bdr);border-radius:var(--r2);padding:16px;text-align:center">'+
      '<div style="font-size:22px;font-weight:700;font-family:var(--mono);color:var(--acc)">'+charCount+'</div>'+
      '<div style="font-size:11px;color:var(--t3);margin-top:2px">글자 수</div>'+
    '</div>'+
    '<div style="background:var(--white);border:1px solid var(--bdr);border-radius:var(--r2);padding:16px;text-align:center">'+
      '<div style="font-size:22px;font-weight:700;font-family:var(--mono);color:var(--blu)">'+readMin+':'+String(readSecR).padStart(2,'0')+'</div>'+
      '<div style="font-size:11px;color:var(--t3);margin-top:2px">예상 길이</div>'+
    '</div>'+
    '<div style="background:var(--white);border:1px solid var(--bdr);border-radius:var(--r2);padding:16px;text-align:center">'+
      '<div style="font-size:22px;font-weight:700;font-family:var(--mono);color:var(--grn)">'+S.ekw.length+'</div>'+
      '<div style="font-size:11px;color:var(--t3);margin-top:2px">키워드</div>'+
    '</div>'+
    '<div style="background:var(--white);border:1px solid var(--bdr);border-radius:var(--r2);padding:16px;text-align:center">'+
      '<div style="font-size:22px;font-weight:700;font-family:var(--mono);color:var(--yel)">'+(v.score||'-')+'</div>'+
      '<div style="font-size:11px;color:var(--t3);margin-top:2px">영상 점수</div>'+
    '</div>'+
  '</div>'+

  // 원본 영상 (컴팩트)
  '<div class="cd" style="margin-bottom:14px"><div style="display:flex;align-items:center;gap:14px">'+
    (v.thumb?'<img src="'+v.thumb+'" style="width:80px;height:45px;border-radius:6px;object-fit:cover">':'')+
    '<div style="flex:1"><div style="font-size:14px;font-weight:600;line-height:1.4">'+esc(v.title)+'</div>'+
    '<div style="font-size:12px;color:var(--t3);margin-top:2px">'+esc(v.ch)+' · ▶ '+fmt(v.views||0)+' · 구독 '+fmt(v.subs||0)+'</div></div>'+
    '<span class="bdg ba">점수 '+(v.score||'-')+'</span>'+
  '</div></div>'+

  // 대본 (메인 카드)
  '<div class="cd" style="margin-bottom:14px;border-color:var(--acc-ring)">'+
    '<div class="cdh"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:16px">📝</span><div class="st" style="margin:0;font-size:16px">'+(sc.title||'최종 대본')+'</div></div>'+
    '<div style="display:flex;gap:6px"><button class="btn bs" style="font-size:12px" onclick="navigator.clipboard.writeText(S.es||S.scr.content);toast(\'복사됨\')">복사</button></div></div>'+
    '<div class="out" style="max-height:200px;overflow-y:auto;padding:16px;background:var(--bg);border-radius:var(--r);line-height:1.9;font-size:14px">'+esc(txt)+'</div>'+
  '</div>'+

  // 음성 + 키워드 (2열)
  '<div class="g2" style="margin-bottom:14px">'+
    // 음성 플레이어
    '<div class="cd" style="margin:0">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><span style="font-size:16px">🔊</span><div class="st" style="margin:0">음성</div></div>'+
      (S.voiceResult&&S.voiceResult.url?
        '<audio id="s11Audio" src="'+S.voiceResult.url+'" preload="auto"></audio>'+
        '<div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg);border-radius:var(--r)">'+
          '<button onclick="var a=document.getElementById(\'s11Audio\');if(a.paused)a.play();else a.pause();" style="width:40px;height:40px;border-radius:50%;background:var(--acc);border:none;color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(255,71,87,.25)">▶</button>'+
          '<div style="flex:1"><div style="font-size:13px;font-weight:600">'+(S.voiceResult.provider||'AI TTS')+'</div>'+
          '<div style="font-size:11px;color:var(--t3)">'+(S.voiceResult.voiceName||'')+'</div></div>'+
          '<span style="font-family:var(--mono);font-size:12px;color:var(--t3)">'+mn+':'+String(se).padStart(2,'0')+'</span>'+
        '</div>'
      :'<div style="padding:20px;text-align:center;color:var(--t4);font-size:12px">음성 미생성</div>')+
    '</div>'+
    // 풋티지 브리프
    '<div class="cd" style="margin:0">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><span style="font-size:16px">🎬</span><div class="st" style="margin:0">풋티지</div></div>'+
      '<div style="display:flex;gap:5px;flex-wrap:wrap">'+(S.ekw[0]&&S.ekw[0].scene?S.ekw.map(function(s){
        return'<span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:500;background:var(--bg2);color:var(--t2)">'+esc(s.label)+': '+esc(s.mainEn)+'</span>';
      }).join(''):S.ekw.map(function(k){
        return'<span style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:500;background:var(--bg2);color:var(--t2)">'+esc(k.v||k.mainEn||'')+'</span>';
      }).join(''))+'</div>'+
    '</div>'+
  '</div>'+

  // 패키지 파일 목록 (접이식)
  '<div class="cd"><div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;cursor:pointer" onclick="var el=document.getElementById(\'pkgFiles\');el.style.display=el.style.display===\'none\'?\'flex\':\'none\'">'+
    '<span style="font-size:16px">📦</span><div class="st" style="margin:0">프로젝트 패키지</div>'+
    '<span style="font-size:11px;color:var(--t3);margin-left:auto">'+fmtB(totalSize)+' · 클릭하여 펼치기</span>'+
  '</div>'+
  '<div id="pkgFiles" style="display:none;flex-direction:column;gap:6px">'+
    [
      {icon:'📄',name:'script.txt',desc:'최종 대본 — 내레이션용',size:fmtB(scriptSize)},
      {icon:'📊',name:'analysis.txt',desc:'영상 분석 결과 — 기획 참고용',size:fmtB(anaSize)},
      {icon:'🎬',name:'footage-brief.txt',desc:'장면별 풋티지 브리프 + Storyblocks 링크',size:fmtB(kwSize)},
      {icon:'📋',name:'project-info.json',desc:'메타데이터',size:fmtB(metaSize)},
    ].map(function(f){return'<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg);border-radius:var(--r);font-size:12px"><span>'+f.icon+'</span><div style="flex:1"><span style="font-weight:600">'+f.name+'</span> <span style="color:var(--t3)">'+f.desc+'</span></div><span style="font-family:var(--mono);color:var(--t4);font-size:11px">'+f.size+'</span></div>';}).join('')+
    (S.voiceResult&&S.voiceResult.blob?'<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg);border-radius:var(--r);font-size:12px"><span>🔊</span><div style="flex:1"><span style="font-weight:600">voice.mp3</span> <span style="color:var(--t3)">AI 음성 파일</span></div><span style="font-family:var(--mono);color:var(--t4);font-size:11px">'+fmtB(S.voiceResult.blob.size)+'</span></div>':'')+
  '</div></div>';
};

// ══════════════════════════════════════════════

// ── ZIP 다운로드 ──
function downloadPkg(){
var v=S.sv||{};var sc=S.scr||{};var txt=S.es||sc.content||'';
var kwTxt=S.ekw[0]&&S.ekw[0].scene?S.ekw.map(function(s){return'[장면 '+s.scene+'] '+s.label+'\n대사: '+s.text+'\n목적: '+s.purpose+'\n검색어: '+s.mainEn+' / '+(s.altEn||[]).join(', ')+'\n한글: '+(s.ko||'')+'\n컷 길이: '+(s.cut||'')+'\nStoryblocks: https://www.storyblocks.com/video/search/'+encodeURIComponent(s.mainEn);}).join('\n\n'):S.ekw.map(function(k){return(k.v||k.mainEn||'')+(k.en?' → '+k.en:'');}).join('\n');
var zip=new JSZip();
var folderName=(sc.title||'이슈유튜브_'+new Date().toISOString().slice(0,10)).replace(/[<>:"/\\|?*]/g,'_');
zip.file('script.txt',txt);
zip.file('analysis.txt',JSON.stringify(S.ana||{},null,2));
zip.file('footage-brief.txt',kwTxt);
zip.file('project-info.json',JSON.stringify({title:sc.title||'',originalVideo:{title:v.title,channel:v.ch,views:v.views,score:v.score},style:S.sty,keywords:S.ekw,thumbnails:S.thumbs||[],createdAt:new Date().toISOString()},null,2));
if(S.thumbs&&S.thumbs.length){zip.file('thumbnail-texts.txt','썸네일 문구 추천\n\n'+S.thumbs.map(function(t,i){return(i+1)+'. '+t;}).join('\n'));}
if(S.voiceResult&&S.voiceResult.blob){zip.file('voice.mp3',S.voiceResult.blob);}
toast('패키지 생성 중...');
zip.generateAsync({type:'blob'}).then(function(blob){
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=folderName+'.zip';a.click();URL.revokeObjectURL(a.href);
  toast('패키지 다운로드 완료 ('+folderName+'.zip)');
}).catch(function(e){toast('ZIP 생성 실패: '+e.message,'err');});
}

// ── 이전 스크립트 복원 (api.js에서 이관) ──
function restoreScript(idx){
  var hist=S.scriptHistory||[];var rev=hist.slice(0,-1).reverse();
  if(rev[idx]){sSet({scr:rev[idx],es:rev[idx].content});window.ls6();}
}

