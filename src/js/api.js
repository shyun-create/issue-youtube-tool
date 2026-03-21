// ═══════════════════════════════════════
// api.js — API 호출 (프록시 경유 / 목업 fallback)
// client-proxy.js가 로드되면 일부 메서드를 프록시 버전으로 덮어씀
// ═══════════════════════════════════════

var Api={
  login:function(email,password){
    if(!email||!password)return Promise.reject(new Error('이메일과 비밀번호를 입력하세요'));
    return authLogin(email,password).then(function(user){
      return{id:user.id,name:user.name||user.email,email:user.email,role:user.role||'user',cohort:user.cohort||''};
    }).catch(function(e){
      // 프록시 미연결 또는 네트워크 오류 시 mock 모드
      if(e.message==='Failed to fetch'||e.message==='프록시 미연결'){
        return{id:'mock',name:'오프라인 모드',email:email,role:'user'};
      }
      throw e;
    });
  },
  getKw:function(){return wait(400).then(function(){var stored;try{stored=JSON.parse(localStorage.getItem('yt_a_kw'));}catch(e){}return(stored||M.keywords).filter(function(k){return k.on!==false;});});},
  getIssueLink:function(){
    var c=cfg();
    if(!c.gas||typeof c.gas!=='string'){return Promise.resolve({hotKeywords:[],posts:[]});}
    return fetch(c.gas+'?action=issuelink&cat=all',{redirect:'follow'}).then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(d){
      if(d.error){toast('이슈링크: '+d.error,'err');return{hotKeywords:[],posts:[]};}
      return{hotKeywords:d.hotKeywords||[],posts:d.posts||[]};
    }).catch(function(e){console.error('IssueLink error:',e);return{hotKeywords:[],posts:[]};});
  },
  getSubtitle:function(videoId){
    if(!videoId)return Promise.resolve({text:'',error:'no videoId'});
    // Electron에서는 직접 자막 추출 (CORS 제한 없음)
    if(window.electronAPI&&window.electronAPI.isElectron){
      return window.electronAPI.getSubtitle(videoId).then(function(d){
        if(d.error)console.warn('Subtitle:',d.error);
        return d;
      });
    }
    // 웹에서는 GAS 경유 (현재 YouTube 차단으로 비활성)
    var c=cfg();if(!c.gas||typeof c.gas!=='string')return Promise.resolve({text:'',error:'no GAS URL'});
    return fetch(c.gas+'?action=subtitle&videoId='+encodeURIComponent(videoId),{redirect:'follow'}).then(function(r){return r.json();}).then(function(d){
      if(d.error)console.warn('Subtitle:',d.error);
      return d;
    }).catch(function(e){console.error('Subtitle error:',e);return{text:'',error:e.message};});
  },
  getVids:function(kwLabels,days){
    // client-proxy.js가 프록시 버전으로 덮어씀. 패치 전 fallback:
    return wait(600).then(function(){return M.videos.slice().sort(function(a,b){return b.score-a.score;});});
  },
  analyze:function(v,transcript){
    if(!hasKey('llm'))return wait(2000).then(function(){return M.analysis;});
    var hasT=transcript&&transcript.length>50;
    var prompt='당신은 유튜브 콘텐츠 전략 분석가입니다.\n\n아래 유튜브 영상의 성과를 분석해주세요.\n\n[영상 정보]\n- 제목: '+v.title+'\n- 채널: '+v.ch+'\n- 조회수: '+v.views+'\n- 구독자: '+v.subs+'\n- 설명: '+(v.desc||'없음')+'\n'+(hasT?'\n[영상 자막 전문]\n'+transcript+'\n':'')+'\n[중요 규칙]\n- 제목과 설명에서 확인할 수 있는 정보만 사용하세요\n- 영상 내용을 추측하거나 지어내지 마세요\n- 구체적인 수치, 사건, 인물을 임의로 만들지 마세요\n- 확인할 수 없는 내용은 "제목으로 보아 ~한 내용으로 추정"이라고 표현하세요\n\n[분석 항목]\n1. summary: 이 영상의 제목/조회수를 기반으로 왜 인기가 있는지 3줄로 분석'+(hasT?' (자막 내용 기반으로 구체적으로)':'')+'\n2. hooks: 제목에서 드러나는 훅 포인트 3개 (호기심, 논란, 반전 등)\n3. structure: 이런 주제의 숏폼 영상에 적합한 구조 5단계 제안\n4. reasons: 이 영상이 잘된 이유 3가지 (제목 매력, 시의성, 타겟 등)\n\nJSON 형식으로만 응답하세요.\n{"summary":"...","hooks":["...","...","..."],"structure":["...","...","...","...","..."],"reasons":["...","...","..."]}';
    return callLLM(prompt).then(function(t){try{return JSON.parse(t.replace(/```json|```/g,'').trim());}catch(e){return{summary:t.substring(0,300),hooks:['분석 결과를 확인하세요'],structure:['전체 내용 참조'],reasons:['AI 분석 완료']};}});
  },
  genScript:function(ana,sty,styPrompt){
    if(!hasKey('llm'))return wait(2500).then(function(){return M.script;});
    var hasT=S.transcript&&S.transcript.length>50;
    var styleBlock=styPrompt?'\n[스타일 규칙 (반드시 준수)]\n'+styPrompt+'\n':'\n[스타일: '+sty+']\n';
    var prompt='당신은 유튜브 숏폼(Shorts/릴스) 전문 대본 작가입니다.\n\n아래 분석 결과를 바탕으로 유튜브 숏폼 대본을 작성해주세요.\n\n[분석 결과]\n- 요약: '+ana.summary+'\n- 훅 포인트: '+ana.hooks.join(', ')+'\n- 잘된 이유: '+ana.reasons.join(', ')+'\n'+(hasT?'\n[원본 영상 자막 (참고용)]\n'+S.transcript+'\n':'')+styleBlock+'\n[작성 규칙]\n- 분량: 200~400자 (30초~1분 숏폼용)\n- 구조: 첫 문장 훅 (3초 안에 시선 잡기) → 핵심 내용 (15~30초) → 반전 또는 결론 (마지막 5초)\n- 문장은 극도로 짧게. 한 문장 15자 이내 권장\n- 숏폼 화법 사용\n- 불필요한 설명 제거, 임팩트 있는 팩트만\n- 절대로 구체적인 수치, 날짜, 사건을 지어내지 마세요\n- 영상 제목과 분석에서 확인된 사실만 사용하세요\n- 모르는 내용은 추측하지 말고 "~라고 하는데요" 정도로 가볍게 표현'+(hasT?'\n- 원본 자막의 핵심 팩트를 활용하되 그대로 복사하지 말고 숏폼에 맞게 재구성':'')+'\n- 마지막에 팔로우 CTA\n- JSON이나 코드를 절대 포함하지 말 것\n\n대본 제목을 첫 줄에, 그 다음부터 대본 본문을 작성하세요.\n순수한 대본 텍스트만 출력하세요.';
    return callLLM(prompt).then(function(t){
      var clean=t.replace(/```json|```/g,'').trim();
      try{var j=JSON.parse(clean);if(j.title&&j.content)return j;}catch(e){}
      var lines=clean.split('\n');var title=lines[0].replace(/^#+\s*|^\*+\s*/g,'').trim();
      var content=lines.slice(1).join('\n').trim();
      if(!content){content=title;title='AI 생성 대본';}
      return{title:title,content:content};
    });
  },
  factCheck:function(sc){
    if(!hasKey('llm'))return wait(1800).then(function(){return M.fcs.slice();});
    var hasT=S.transcript&&S.transcript.length>50;
    var videoTitle=S.sv?S.sv.title:'';
    var prompt='당신은 팩트체크 전문가입니다.\n\n아래 유튜브 숏폼 대본에서 사실 확인이 필요한 문장을 찾아주세요.\n\n[영상 주제]\n'+videoTitle+'\n\n[대본]\n'+sc+'\n'+(hasT?'\n[원본 영상 자막 (검증 참고용)]\n'+S.transcript+'\n':'')+'\n[규칙]\n- 반드시 영상 주제와 직접 관련된 내용만 검증하세요\n- 영상 주제와 무관한 일반적인 문장은 절대 포함하지 마세요\n- "팔로우", "좋아요", "댓글" 같은 CTA 문구는 검증 대상이 아닙니다\n- 수치, 통계, 날짜, 인물, 사건 등 구체적 사실 주장만 확인하세요'+(hasT?'\n- 원본 자막과 대본 내용이 다른 부분이 있으면 warning으로 표시':'')+'\n- safe(사실 확인됨)/warning(확인 필요)/uncertain(미확인)으로 분류\n- 검증할 문장이 없으면 빈 배열 []을 반환하세요\n- 최대 3개까지만 추출\n- text 필드에는 대본에 있는 문장을 정확히 그대로 복사하세요 (한 글자도 바꾸지 마세요)\n\nJSON 배열로만 응답하세요.\n[{"id":"f1","text":"대본에서 그대로 복사한 문장","st":"safe 또는 warning 또는 uncertain","note":"판단 근거"}]';
    return callLLM(prompt).then(function(t){try{return JSON.parse(t.replace(/```json|```/g,'').trim());}catch(e){return M.fcs.slice();}});
  },
  extractKw:function(sc){
    if(!hasKey('llm'))return wait(1200).then(function(){return M.ekw.slice();});
    var videoTitle=S.sv?S.sv.title:'';
    var prompt='당신은 유튜브 영상 편집 전문가입니다.\n\n아래 대본을 장면 단위로 나누고, 각 장면에 필요한 풋티지(B-roll) 검색 정보를 만들어주세요.\n\n[영상 주제]\n'+videoTitle+'\n\n[대본]\n'+sc+'\n\n[규칙]\n- 대본을 5~8개 장면으로 나누세요\n- 각 장면의 대표 문장(text)은 대본에서 그대로 가져오세요\n- label은 짧게: 후킹, 사건설명, 인물소개, 배경설명, 핵심주장, 숫자강조, 긴장감, 전환, 마무리 중 선택\n- purpose는 이 장면이 왜 필요한지 한 줄로\n- mainEn은 Storyblocks에서 가장 잘 검색될 영문 키워드 (2~3단어)\n- altEn은 대체 영문 검색어 2개\n- ko는 한글 키워드 1개\n- cut은 추천 컷 길이 (예: 2-3초)\n- 특정 인물 이름을 검색어에 넣지 마세요 (스톡 영상에는 특정 인물이 없습니다)\n- mainEn은 Storyblocks에서 실제 검색 가능한 일반적인 장면이어야 합니다\n\nJSON 배열로만 응답하세요.\n[{"scene":1,"label":"후킹","text":"대본에서 가져온 문장","purpose":"긴장감 있는 도입","mainEn":"breaking news studio","altEn":["urgent headline","war room"],"ko":"속보 뉴스","cut":"2-3초"}]';
    return callLLM(prompt).then(function(t){try{return JSON.parse(t.replace(/```json|```/g,'').trim());}catch(e){return M.ekw.slice();}});
  },
  getTrends:function(){
    // client-proxy.js가 프록시 버전으로 덮어씀. 패치 전 fallback:
    return Promise.resolve([]);
  },
  genVoice:function(text,voiceId){
    // client-proxy.js가 프록시 버전으로 덮어씀. 패치 전 fallback:
    return wait(2000).then(function(){return M.voice;});
  },
  genThumb:function(title,script){
    // client-proxy.js가 프록시 버전으로 덮어씀. 패치 전 fallback:
    return wait(1500).then(function(){return['충격! '+title,'이것만 알면 인생이 바뀝니다','아무도 몰랐던 진실'];});
  }
};
// genElevenLabs, uploadToElevenLabs, callLLM → client-proxy.js에서 프록시 경유 버전으로 제공

function smartDedup(labels){
  // 짧은 키워드가 긴 키워드에 포함되면 제거
  return labels.filter(function(a){
    return!labels.some(function(b){return b!==a&&b.length>a.length&&b.indexOf(a)!==-1;});
  });
}
