// ═══════════════════════════════════════════════════════════
// client-proxy.js v3 — Supabase Auth (이메일/비밀번호) 기반
// ═══════════════════════════════════════════════════════════

var PROXY_BASE = 'https://wotseowsskgobnusiacg.supabase.co/functions/v1/proxy';

// ── 세션 관리 ──
function getSession() {
  try { return JSON.parse(localStorage.getItem('yt_session') || 'null'); } catch(e) { return null; }
}
function setSession(s) { localStorage.setItem('yt_session', JSON.stringify(s)); }
function clearSession() { localStorage.removeItem('yt_session'); }
function getToken() { var s = getSession(); return s ? s.access_token : ''; }
function getUser() { var s = getSession(); return s ? s.user : null; }

// ── cfg() / hasKey() 호환 ──
function cfg() {
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem('yt_a_set') || '{}'); } catch(e) {}
  return { proxy: true, yt: true, llm: true, gas: true, llmP: saved.llmP || 'claude' };
}
function hasKey(k) { return !!getToken(); }

// ── 공통 fetch wrapper ──
function proxyFetch(endpoint, options) {
  options = options || {};
  options.headers = options.headers || {};
  var token = getToken();
  if (token) options.headers['Authorization'] = 'Bearer ' + token;
  return fetch(PROXY_BASE + endpoint, options).then(function(r) {
    if (r.status === 401) {
      // auth 엔드포인트이거나 세션 관련 에러만 로그아웃 처리
      var isAuthEndpoint = endpoint === '/api/me' || endpoint.indexOf('/auth/') === 0;
      if (isAuthEndpoint) {
        clearSession();
        toast('세션이 만료되었습니다. 다시 로그인해주세요.', 'err');
        if (typeof doLogout === 'function') doLogout();
        throw new Error('AUTH_REQUIRED');
      }
      // API 키 에러 등은 로그아웃하지 않고 에러만 전달
      return r.clone().json().then(function(d) {
        var msg = d.error || 'API 인증 오류';
        if (d.debug && d.debug._error) msg += ' (' + d.debug._error + ')';
        throw new Error(msg);
      }).catch(function(e) { if (e.message === 'AUTH_REQUIRED') throw e; throw new Error(e.message || 'HTTP 401'); });
    }
    if (r.status === 403) {
      return r.clone().json().then(function(d) {
        if (d.code === 'APPROVAL_PENDING') {
          toast('관리자 승인 대기 중입니다.', 'err');
          throw new Error('APPROVAL_PENDING');
        }
        throw new Error(d.error || 'Forbidden');
      });
    }
    if (r.status === 429) {
      toast('요청 한도를 초과했습니다.', 'err');
      throw new Error('RATE_LIMIT');
    }
    return r;
  });
}

// ── 로그인 API ──
function authLogin(email, password) {
  return fetch(PROXY_BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  }).then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
  .then(function(res) {
    if (res.status !== 200) throw new Error(res.data.error || '로그인 실패');
    if (res.data.user && res.data.user.approval_status !== '승인완료') {
      throw new Error('관리자 승인 대기 중입니다. 승인 후 이용 가능합니다.');
    }
    setSession({ access_token: res.data.access_token, refresh_token: res.data.refresh_token, user: res.data.user });
    return res.data.user;
  });
}

// ── 회원가입 API ──
function authSignup(email, password, name, phone, cohort) {
  return fetch(PROXY_BASE + '/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password, name: name, phone: phone, cohort: cohort })
  }).then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
  .then(function(res) {
    if (res.status !== 200) throw new Error(res.data.error || '회원가입 실패');
    return res.data;
  });
}

// ══════════════════════════════════════════════
// callLLM — 기존 함수 대체
// ══════════════════════════════════════════════
function callLLM(prompt, retries) {
  retries = retries || 0;
  var provider = (cfg().llmP || 'claude').toLowerCase();
  return proxyFetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt, provider: provider })
  }).then(function(r) {
    if (!r.ok) {
      if (r.status === 429 && retries < 3) {
        toast('AI 요청 한도 초과 — ' + (5 * (retries + 1)) + '초 후 재시도...', 'err');
        return wait(5000 * (retries + 1)).then(function() { return callLLM(prompt, retries + 1); });
      }
      return r.clone().json().then(function(d) {
        var msg = d.error || 'LLM: HTTP ' + r.status;
        if (d.code === 'UPSTREAM_ERROR') msg = 'AI API 오류: ' + (d.detail && d.detail.error && d.detail.error.message || JSON.stringify(d.detail || ''));
        if (d.code === 'MISSING_KEY') msg = d.error;
        throw new Error(msg);
      }).catch(function(e) { throw e; });
    }
    return r.json();
  }).then(function(d) {
    if (d.content) return d.content.map(function(c) { return c.text; }).join('');
    if (d.candidates) return d.candidates[0].content.parts[0].text || '';
    return typeof d === 'string' ? d : JSON.stringify(d);
  });
}

// ══════════════════════════════════════════════
// genElevenLabs / uploadToElevenLabs 대체
// ══════════════════════════════════════════════
function genElevenLabs(text, voiceId) {
  if (!voiceId) return Promise.reject(new Error('ElevenLabs 음성 ID가 없습니다.'));
  return proxyFetch('/api/elevenlabs/tts/' + voiceId, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
  }).then(function(r) { if (!r.ok) throw new Error('ElevenLabs: HTTP ' + r.status); return r.blob(); })
  .then(function(blob) { return { url: URL.createObjectURL(blob), blob: blob, dur: Math.round(text.length / 6), provider: 'ElevenLabs', voiceName: '내 목소리' }; });
}

function uploadToElevenLabs(file) {
  var formData = new FormData();
  formData.append('name', '내 목소리 - ' + new Date().toLocaleDateString('ko'));
  formData.append('files', file);
  formData.append('description', 'Issue YouTube Tool custom voice');
  return proxyFetch('/api/elevenlabs/voices/add', { method: 'POST', body: formData })
    .then(function(r) { if (!r.ok) throw new Error('업로드 실패'); return r.json(); })
    .then(function(d) { return d.voice_id; });
}

// ══════════════════════════════════════════════
// Api 패치 — DOMContentLoaded 후 실행
// ══════════════════════════════════════════════
(function() {
  function patchApi() {
    if (typeof Api === 'undefined') return;

    Api.getIssueLink = function() {
      return proxyFetch('/api/gas?action=issuelink&cat=all').then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function(d) { return { hotKeywords: d.hotKeywords || [], posts: d.posts || [] }; })
        .catch(function(e) { if (e.message === 'AUTH_REQUIRED' || e.message === 'RATE_LIMIT') return { hotKeywords: [], posts: [] }; return { hotKeywords: [], posts: [] }; });
    };

    Api.getSubtitle = function(videoId) {
      if (!videoId) return Promise.resolve({ text: '', error: 'no videoId' });
      if (window.electronAPI && window.electronAPI.isElectron) return window.electronAPI.getSubtitle(videoId);
      return proxyFetch('/api/gas?action=subtitle&videoId=' + encodeURIComponent(videoId))
        .then(function(r) { return r.json(); }).catch(function(e) { return { text: '', error: e.message }; });
    };

    Api.getVids = function(kwLabels, days) {
      if (!hasKey()) return wait(600).then(function() { return M.videos.slice().sort(function(a, b) { return b.score - a.score; }); });
      var d = new Date(); d.setDate(d.getDate() - (days || 7)); var since = d.toISOString();
      var perKw = Math.max(3, Math.floor(15 / kwLabels.length));
      var searches = kwLabels.map(function(q) {
        return proxyFetch('/api/youtube/search?part=snippet&q=' + encodeURIComponent(q) + '&type=video&order=viewCount&publishedAfter=' + since + '&maxResults=' + perKw + '&regionCode=KR&relevanceLanguage=ko')
          .then(function(r) { if (!r.ok) return r.json().then(function(d) { throw new Error(d.error ? d.error.message : 'HTTP ' + r.status); }); return r.json(); })
          .then(function(data) { return data.items || []; });
      });
      return Promise.all(searches).then(function(results) {
        var allItems = []; var seen = {};
        results.forEach(function(items) { items.forEach(function(i) { var vid = i.id.videoId; if (vid && !seen[vid]) { seen[vid] = true; allItems.push(i); } }); });
        var ids = allItems.map(function(i) { return i.id.videoId; }).filter(Boolean);
        if (!ids.length) return [];
        return proxyFetch('/api/youtube/videos?part=snippet,statistics&id=' + ids.join(','))
          .then(function(r) { return r.json(); }).then(function(vd) {
            var chIds = vd.items.map(function(i) { return i.snippet.channelId; }).filter(function(v, i, a) { return a.indexOf(v) === i; });
            return proxyFetch('/api/youtube/channels?part=statistics&id=' + chIds.join(','))
              .then(function(r) { return r.json(); }).then(function(cd) {
                var cm = {}; cd.items.forEach(function(ch) { cm[ch.id] = parseInt(ch.statistics.subscriberCount || 0); });
                return scoreVids(vd.items.map(function(it) { return { id: it.id, title: it.snippet.title, ch: it.snippet.channelTitle, thumb: (it.snippet.thumbnails.high || it.snippet.thumbnails.default).url, date: it.snippet.publishedAt.substring(0, 10), views: parseInt(it.statistics.viewCount || 0), likes: parseInt(it.statistics.likeCount || 0), subs: cm[it.snippet.channelId] || 0, desc: it.snippet.description || '', score: 0, news: false }; }));
              });
          });
      }).catch(function(e) { if (e.message === 'AUTH_REQUIRED') return []; return M.videos.slice().sort(function(a, b) { return b.score - a.score; }); });
    };

    Api.genVoice = function(text, voiceId) {
      var script = text || S.es || S.scr && S.scr.content || '';
      if (!script) return Promise.reject(new Error('대본이 없습니다'));
      if (voiceId === 'custom' && S.elVoiceId) return genElevenLabs(script, S.elVoiceId);
      if (hasKey()) {
        var voiceMap = { 'vc1': { name: 'ko-KR-Neural2-C', gender: 'MALE' }, 'vc2': { name: 'ko-KR-Neural2-A', gender: 'FEMALE' }, 'vc3': { name: 'ko-KR-Neural2-C', gender: 'MALE' }, 'vc4': { name: 'ko-KR-Neural2-B', gender: 'FEMALE' }, 'vc5': { name: 'ko-KR-Wavenet-A', gender: 'FEMALE' }, 'vc6': { name: 'ko-KR-Wavenet-C', gender: 'MALE' }, 'vc7': { name: 'ko-KR-Wavenet-B', gender: 'FEMALE' }, 'vc8': { name: 'ko-KR-Wavenet-D', gender: 'FEMALE' }, 'vc9': { name: 'ko-KR-Wavenet-C', gender: 'MALE' } };
        var voice = voiceMap[voiceId] || voiceMap['vc4'];
        return proxyFetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: { text: script }, voice: { languageCode: 'ko-KR', name: voice.name, ssmlGender: voice.gender }, audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 } })
        }).then(function(r) { if (!r.ok) return r.json().then(function(d) { throw new Error(d.error ? d.error.message : 'TTS: HTTP ' + r.status); }); return r.json(); })
        .then(function(d) { var audioBlob = b64toBlob(d.audioContent, 'audio/mp3'); return { url: URL.createObjectURL(audioBlob), blob: audioBlob, dur: Math.round(script.length / 6), provider: 'Google Cloud TTS', voiceName: voice.name }; });
      }
      return wait(2000).then(function() { return M.voice; });
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(patchApi, 0); });
  } else { setTimeout(patchApi, 0); }
})();

// ── playVoicePreview / handleVoiceUpload 패치 ──
(function() {
  function patchVoice() {
    window.playVoicePreview = function(btn) {
      if (window._previewAudio && !window._previewAudio.paused) { window._previewAudio.pause(); window._previewAudio = null; btn.querySelector('span').textContent = '▶'; document.getElementById('vpTime').textContent = '미리듣기'; return; }
      var voiceName = btn.dataset.voice;
      if (!hasKey()) { toast('로그인이 필요합니다', 'err'); return; }
      btn.querySelector('span').textContent = '⏳'; document.getElementById('vpTime').textContent = '로딩...';
      proxyFetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { text: '안녕하세요, 이 음성은 AI가 생성한 샘플입니다.' }, voice: { languageCode: 'ko-KR', name: voiceName }, audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 } })
      }).then(function(r) { return r.json(); }).then(function(d) {
        if (!d.audioContent) { toast('TTS 실패', 'err'); btn.querySelector('span').textContent = '▶'; return; }
        window._previewAudio = new Audio('data:audio/mp3;base64,' + d.audioContent); window._previewAudio.play();
        btn.querySelector('span').textContent = '⏸'; document.getElementById('vpTime').textContent = '재생 중';
        var bars = document.getElementById('vpWave').children;
        var animId = setInterval(function() { for (var i = 0; i < bars.length; i++) { bars[i].style.height = (6 + Math.random() * 14) + 'px'; bars[i].style.background = window._previewAudio.paused ? 'var(--bg3)' : 'var(--acc)'; } }, 150);
        window._previewAudio.onended = function() { clearInterval(animId); btn.querySelector('span').textContent = '▶'; document.getElementById('vpTime').textContent = '미리듣기'; };
      }).catch(function(e) { toast('TTS 에러: ' + e.message, 'err'); btn.querySelector('span').textContent = '▶'; });
    };

    window.handleVoiceUpload = function(input) {
      var file = input.files[0]; if (!file) return;
      if (!hasKey()) { document.getElementById('uploadStatus').textContent = '로그인이 필요합니다'; return; }
      document.getElementById('uploadStatus').textContent = '업로드 중...'; document.getElementById('uploadStatus').style.color = 'var(--t3)';
      uploadToElevenLabs(file).then(function(voiceId) {
        sSet({ selVoice: 'custom' }); S.elVoiceId = voiceId;
        document.getElementById('uploadStatus').textContent = '✓ 목소리 학습 완료'; document.getElementById('uploadStatus').style.color = 'var(--grn)';
      }).catch(function(e) { document.getElementById('uploadStatus').textContent = '업로드 실패: ' + e.message; document.getElementById('uploadStatus').style.color = 'var(--red)'; });
    };
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function() { setTimeout(patchVoice, 100); }); }
  else { setTimeout(patchVoice, 100); }
})();

// ── API Badge 패치 ──
(function() {
  function patchBadges() {
    if (typeof syncSb === 'undefined') return;
    var origSyncSb = syncSb;
    window.syncSb = function() {
      origSyncSb();
      var ab = document.getElementById('apiBadges');
      if (ab) {
        var user = getUser();
        var b = '';
        if (user) {
          b += '<span class="bdg bg2" style="font-size:9px;padding:2px 6px">AUTH</span>';
          b += '<span class="bdg bg2" style="font-size:9px;padding:2px 6px">YT</span>';
          b += '<span class="bdg bg2" style="font-size:9px;padding:2px 6px">Claude</span>';
        }
        if (window.electronAPI && window.electronAPI.isElectron) b += '<span class="bdg ba" style="font-size:9px;padding:2px 6px">Electron</span>';
        if (!b) b = '<span class="bdg bgy" style="font-size:9px;padding:2px 6px">MOCK</span>';
        ab.innerHTML = b;
      }
    };
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function() { setTimeout(patchBadges, 50); }); }
  else { setTimeout(patchBadges, 50); }
})();
