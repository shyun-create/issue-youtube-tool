# 이슈 유튜브 제작툴

체인저스캠퍼스 × anderson.asia

## 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 개발 모드 실행
npm start

# 3. Windows .exe 빌드
npm run build:win

# 4. GitHub Releases에 배포 (자동 업데이트용)
export GH_TOKEN=ghp_xxxxxxxx
npm run deploy
```

## 프로젝트 구조

```
├── main.js              # Electron 메인 (자막 추출 + autoUpdater)
├── preload.js           # Electron 보안 브릿지
├── package.json         # 앱 설정 + 빌드 설정
├── src/
│   ├── index.html       # 수강생 앱 화면
│   ├── client-proxy.js  # Supabase 프록시 통신
│   └── admin.html       # 관리자 페이지
└── supabase/
    └── functions/
        └── proxy/
            └── index.ts # Edge Function (서버)
```

## Supabase 설정

- 프로젝트: wotseowsskgobnusiacg (개인 테스트용)
- Edge Function: proxy (배포 완료)
- Secrets: YOUTUBE_API_KEY, CLAUDE_API_KEY, GAS_URL, ADMIN_SECRET, GOOGLE_TTS_KEY

## 회사 이전 시

1. 회사 Supabase에 새 프로젝트 생성
2. SQL 실행 (profiles + usage_logs)
3. Edge Function 배포
4. client-proxy.js의 PROXY_BASE URL 변경
