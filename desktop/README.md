# Markdown Editor 데스크톱 1.0.0

Electron 설치 앱입니다. 공개 편집기 51c7183의 한국어·영어·일본어·중국어(간체) UI와 설정 언어 선택을 재사용합니다. 웹 서비스와 EMM 앱은 변경하지 않습니다.

## 산출물
- Windows x64: NSIS .exe 설치 마법사, 사용자 계정 단위 설치
- macOS Intel x64 / Apple Silicon arm64: 각각 .dmg
- Linux x64: .deb 설치 패키지 및 AppImage

## 기능과 보안
- 라이브러리를 로컬에 포함합니다. 최초 실행·편집·Mermaid·오프라인 md.html 저장에 CDN 접속이 필요하지 않습니다. 온라인 md.html로 내보낸 파일은 기존처럼 인터넷 라이브러리를 사용합니다.
- 파일 열기·저장은 운영체제 기본 창을 사용합니다. renderer는 사용자가 선택한 파일의 임의식별자만 받으며 임의경로에 접근할 수 없습니다.
- Node integration 비활성화, context isolation 및 sandbox 활성화. 외부 문서 링크는 http/https만 기본 브라우저로 열고 앱 내 외부 탐색은 차단합니다.
- HTML 코드 미리보기는 별도 sandbox 프로토콜로 실행합니다. 미리보기에는 Node·파일 API와 네트워크 연결 권한을 주지 않습니다(https 이미지 제외).
- 언어 변경은 문서를 유지하나 렌더링 창 Undo 기록을 초기화합니다. 설정에도 안내합니다.

## 빌드
GitHub Actions의 Desktop installers 작업이 각 운영체제에서 빌드·설치·실행 검사를 합니다. Electron45.2.1·electron-builder26.18.0을 고정하고, 라이브러리는 source/vendor-manifest.json의 고정 다운로드 주소와 SHA-256으로 검증합니다. 의존성 lock은 실행당 한 번 생성해 모든 작업에 동일 배포하며 결과 artifact에 보관합니다.

로컬 재빌드: Node24, npm install 또는 해당 실행의 package-lock.json으로 npm ci → npm test → npm run bundle → npm run smoke → npm run dist. macOS DMG는 macOS에서 빌드합니다.

## 서명 및 실행 검증의 범위
Windows는 퍼블리셔 인증서 미제공으로 Authenticode 미서명입니다. macOS는 ad-hoc 서명만 하며 Apple Developer ID 서명·공증은 하지 않습니다. 따라서 OS 보안 경고가 있을 수 있습니다. 정식 배포에는 별도 인증서와 공증 설정이 필요합니다. 보안 기능을 끄도록 요구하지 않습니다.

CI는 합성 파일만 사용하며 macOS DMG 복사/실행, Windows NSIS 무인 설치/실행/제거, Linux DEB 설치/실행/제거를 검사합니다. AppImage는 형식 검사를 하며 FUSE와 배포판별 실행 환경은 사용자 환경에 따라 다를 수 있습니다. Linux CI 실행에서만 headless 환경 때문에 --no-sandbox를 쓰며 정상 앱 실행 설정에는 넣지 않습니다. 실제 사용자의 각 OS에서 수행한 수동 설치 검증은 아닙니다.

각 artifact에는 설치 파일, SHA256SUMS.txt, 빌드 source commit/run ID/lock 해시와 native smoke 결과, 가능한 경우 실행 화면이 포함됩니다.
