const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');

// ═══════════════════════════════════════════════
// 자동 업데이트 (electron-updater)
// GitHub Releases에 새 버전 올리면 자동 감지 → 다운로드 → 설치
// ═══════════════════════════════════════════════
let autoUpdater;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  log.warn('[Update] electron-updater not installed, auto-update disabled');
  autoUpdater = null;
}

if (autoUpdater) {
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  autoUpdater.autoDownload = true;       // 감지되면 자동 다운로드
  autoUpdater.autoInstallOnAppQuit = true; // 앱 종료 시 자동 설치
}

let mainWindow;
let updateStatus = { checking: false, available: false, downloaded: false, version: '', error: null };

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: '이슈 유튜브 제작툴',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile('src/index.html');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  createWindow();
  
  // ── 자동 업데이트 체크 (앱 시작 2초 후) ──
  if (autoUpdater) {
    setTimeout(() => {
      log.info('[Update] Checking for updates...');
      autoUpdater.checkForUpdates().catch(err => {
        log.warn('[Update] Check failed:', err.message);
      });
    }, 2000);

    // 이후 4시간마다 재확인
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 4 * 60 * 60 * 1000);
  }
});

// ── 업데이트 이벤트 핸들러 ──
if (autoUpdater) {
  autoUpdater.on('checking-for-update', () => {
    log.info('[Update] Checking...');
    updateStatus.checking = true;
    sendUpdateStatus();
  });

  autoUpdater.on('update-available', (info) => {
    log.info('[Update] Available:', info.version);
    updateStatus = { checking: false, available: true, downloaded: false, version: info.version, error: null };
    sendUpdateStatus();
  });

  autoUpdater.on('update-not-available', () => {
    log.info('[Update] Already latest version');
    updateStatus = { checking: false, available: false, downloaded: false, version: '', error: null };
    sendUpdateStatus();
  });

  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent);
    if (mainWindow) {
      mainWindow.setProgressBar(pct / 100); // 작업표시줄 진행률
      mainWindow.webContents.send('update-progress', pct);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Update] Downloaded:', info.version);
    updateStatus = { checking: false, available: true, downloaded: true, version: info.version, error: null };
    if (mainWindow) mainWindow.setProgressBar(-1); // 진행률 해제
    sendUpdateStatus();

    // 사용자에게 알림
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '업데이트 준비 완료',
        message: `새 버전 ${info.version}이 다운로드되었습니다.`,
        detail: '앱을 종료하면 자동으로 업데이트가 설치됩니다.\n지금 재시작하시겠습니까?',
        buttons: ['지금 재시작', '나중에'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
    }
  });

  autoUpdater.on('error', (err) => {
    log.error('[Update] Error:', err.message);
    updateStatus = { checking: false, available: false, downloaded: false, version: '', error: err.message };
    if (mainWindow) mainWindow.setProgressBar(-1);
    sendUpdateStatus();
  });
}

function sendUpdateStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', updateStatus);
  }
}

// 렌더러에서 업데이트 상태 요청
ipcMain.handle('get-update-status', () => updateStatus);
ipcMain.handle('check-for-update', () => {
  if (autoUpdater) autoUpdater.checkForUpdates().catch(() => {});
  return { ok: true };
});
ipcMain.handle('install-update', () => {
  if (autoUpdater && updateStatus.downloaded) autoUpdater.quitAndInstall(false, true);
  return { ok: true };
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ═══════════════════════════════════════════════
// 자막 추출: 숨겨진 창에서 YouTube 재생 → 
// webRequest로 timedtext 응답을 가로채기
// YouTube가 자체적으로 로드하는 자막이므로 100% 정상
// ═══════════════════════════════════════════════

ipcMain.handle('get-subtitle', async (event, videoId) => {
  if (!videoId) return { error: 'videoId required', text: '' };
  console.log('[Sub] Start:', videoId);

  return new Promise((resolve) => {
    let resolved = false;
    const done = (data) => {
      if (resolved) return;
      resolved = true;
      data.videoId = videoId;
      if (!data.text) data.text = '';
      console.log('[Sub] Done:', data.method || 'error', data.charCount || 0, 'chars');
      try { hidden.destroy(); } catch(e) {}
      resolve(data);
    };

    // 30초 타임아웃
    setTimeout(() => done({ error: 'Timeout 30s' }), 30000);

    const hidden = new BrowserWindow({
      width: 1280, height: 720, show: false,
      webPreferences: { contextIsolation: false, nodeIntegration: false }
    });
    hidden.webContents.setAudioMuted(true);

    hidden.webContents.on('console-message', (e, level, msg) => {
      console.log('[Hidden]', msg);
    });

    // ★ 핵심: timedtext 요청의 응답을 가로채기
    let captionCaptured = false;
    hidden.webContents.session.webRequest.onCompleted(
      { urls: ['*://*.youtube.com/api/timedtext*', '*://*.google.com/api/timedtext*'] },
      async (details) => {
        if (captionCaptured || resolved) return;
        console.log('[Sub] Intercepted timedtext!', details.url.substring(0, 80), 'status:', details.statusCode);
        
        // 가로챈 URL로 직접 숨겨진 창에서 fetch
        captionCaptured = true;
        try {
          const result = await hidden.webContents.executeJavaScript(`
            (async function() {
              try {
                // json3 시도
                var url = ${JSON.stringify(details.url)};
                var json3Url = url.replace(/fmt=[^&]*/, 'fmt=json3');
                if (json3Url.indexOf('fmt=') === -1) json3Url += '&fmt=json3';
                
                var r = await fetch(json3Url, {credentials: 'include'});
                var body = await r.text();
                console.log('Intercept json3 fetch len:', body.length);
                
                if (body.length > 50) {
                  try {
                    var json = JSON.parse(body);
                    var events = json.events || [];
                    var lines = events.filter(function(e){return e.segs;}).map(function(e){return e.segs.map(function(s){return s.utf8||'';}).join('');}).filter(function(t){return t.trim();});
                    var text = lines.join(' ').replace(/\\n/g,' ').trim();
                    if (text.length > 10) return JSON.stringify({text:text, lineCount:lines.length, charCount:text.length, method:'intercept-json3'});
                  } catch(e) {}
                }
                
                // 원본 URL 재시도
                var r2 = await fetch(url, {credentials: 'include'});
                var body2 = await r2.text();
                console.log('Intercept raw fetch len:', body2.length);
                return JSON.stringify({raw: body2.substring(0, 100000), rawLen: body2.length});
              } catch(e) {
                return JSON.stringify({error: e.message});
              }
            })()
          `);
          
          const data = JSON.parse(result);
          if (data.text) {
            // lang 추출
            const langMatch = details.url.match(/[&?]lang=([^&]+)/);
            const lang = langMatch ? langMatch[1] : 'unknown';
            done({ text: data.text, language: lang, lineCount: data.lineCount, charCount: data.charCount, method: data.method });
          } else if (data.raw && data.rawLen > 50) {
            // XML 파싱
            const matches = [...data.raw.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)];
            if (matches.length > 0) {
              const lines = matches.map(m => m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/<[^>]+>/g,'').trim()).filter(Boolean);
              const text = lines.join(' ');
              const langMatch = details.url.match(/[&?]lang=([^&]+)/);
              if (text.length > 10) {
                done({ text, language: langMatch?langMatch[1]:'unknown', lineCount: lines.length, charCount: text.length, method: 'intercept-xml' });
                return;
              }
            }
          }
          // 이 시도 실패 → 다음 timedtext 이벤트를 기다리거나 타임아웃
          captionCaptured = false;
          console.log('[Sub] Intercept fetch returned empty, waiting for more...');
        } catch(e) {
          captionCaptured = false;
          console.log('[Sub] Intercept error:', e.message);
        }
      }
    );

    // 페이지 로드 후 비디오 재생 시작 (자막 로드 트리거)
    hidden.webContents.on('did-finish-load', () => {
      console.log('[Sub] Page loaded, triggering playback...');
      setTimeout(async () => {
        try {
          // 자동재생이 안 되면 수동으로 재생 트리거
          await hidden.webContents.executeJavaScript(`
            (function() {
              // 동영상 재생 시도
              var video = document.querySelector('video');
              if (video) {
                video.muted = true;
                video.play().catch(function(){});
                console.log('Video play triggered, muted');
              }
              // 자막 버튼 클릭 시도
              var subBtn = document.querySelector('.ytp-subtitles-button');
              if (subBtn && subBtn.getAttribute('aria-pressed') !== 'true') {
                subBtn.click();
                console.log('Subtitle button clicked');
              }
            })()
          `);
        } catch(e) {
          console.log('[Sub] Play trigger error:', e.message);
        }

        // 추가 10초 대기 후 timedtext 가로채기가 없으면 페이지에서 직접 추출 시도
        setTimeout(async () => {
          if (resolved) return;
          console.log('[Sub] No timedtext intercepted, trying page extraction...');
          try {
            const result = await hidden.webContents.executeJavaScript(`
              (function() {
                var player = window.ytInitialPlayerResponse;
                if (!player || !player.captions || !player.captions.playerCaptionsTracklistRenderer) {
                  return JSON.stringify({error: 'No captions'});
                }
                var tracks = player.captions.playerCaptionsTracklistRenderer.captionTracks || [];
                return JSON.stringify({trackCount: tracks.length, langs: tracks.map(function(t){return t.languageCode;})});
              })()
            `);
            console.log('[Sub] Page info:', result);
          } catch(e) {}
          if (!resolved) done({ error: 'No timedtext loaded by YouTube player' });
        }, 10000);
      }, 2000);
    });

    hidden.loadURL('https://www.youtube.com/watch?v=' + videoId);
  });
});

ipcMain.handle('open-admin', () => { mainWindow.loadFile('src/admin.html'); });
ipcMain.handle('open-index', () => { mainWindow.loadFile('src/index.html'); });
