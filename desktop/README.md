# Markdown Editor 데스크톱 1.0.2 공통 편집 수정

Electron 설치 앱입니다. 저장소 루트 index.html의 한국어·영어·일본어·중국어(간체) UI와 설정 언어 선택을 재사용합니다. 공통 원본으로 웹·데스크톱을 제공하며 EMM 사본 반영은 담당 세션에서 진행합니다.

## 산출물
- Windows x64: NSIS .exe 설치 마법사, 현재 사용자 / 모든 사용자 선택(기본: 모든 사용자). 모든 사용자 설치에는 관리자 동의가 필요합니다.
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

## 설치
- Windows: `.exe` 설치 마법사에서 현재 사용자 / 모든 사용자를 선택합니다. 모든 사용자는 Program Files 및 공용 시작메뉴에 설치하며 관리자 권한 동의를 요청합니다. 앱 자체는 asInvoker로 각 로그인 계정의 일반 권한에서 실행합니다.
- macOS: CPU에 맞는 DMG를 열고 Markdown Editor.app을 Applications로 복사합니다. Developer ID/공증 미완료 상태임을 확인하세요.
- Ubuntu/Debian: 설치 파일 폴더에서 `sudo apt install ./MarkdownEditor-1.0.2-linux-amd64.deb`로 설치하면 필요한 시스템 의존성을 함께 설치합니다. `dpkg -i`만 쓰면 빠진 의존성 때문에 설정이 완료되지 않을 수 있습니다.
- AppImage: 파일에 실행 권한을 주고 실행합니다. FUSE·샌드박스 지원은 배포판별로 다르며, 이 빌드에서는 실제 DEB 설치 후 실행을 검증합니다.

## Windows 1.0.1 수정 보존
- 설치 범위·일반 권한 실행·제한 진단 수정을 1.0.2에 그대로 포함합니다. 빌드는 자동 공개하지 않으며 검증한 파일만 릴리스에 게시합니다.
- 설치 범위 양쪽의 HKCU/HKLM 등록·기본 설치 경로·개인/공용 시작메뉴·제거 검사를 추가합니다. 별도 표준 계정의 실제 실행과 계정별 사용자 데이터 분리는 미검증으로 명시합니다.
- 기존 --smoke-test는 GPU off·새 임시 프로필·숨긴 창입니다. 새 일반 시작 검사는 CI에서 기본 GPU 정책·표시 창·기본 영속 프로필의 seed/restore 재시작을 별도로 검사합니다. 실제 사용자 GPU/보안 제품·프로필 문제를 해결했다는 의미는 아닙니다.
- 일반 실행 시작/로드/프리로드/렌더러 종료 진단을 개인정보·문서 내용·전체 스택 없이 제한 기록합니다. 실패한 CI smoke 보고서도 proof에 보존합니다.
- 보안 경고: 정식 코드 서명 인증서는 아직 없으며 미서명 상태를 해결한 것으로 표시하지 않습니다. 모든 사용자 설치의 UAC 권한 동의는 정상 절차이고 SmartScreen/알 수 없는 게시자 경고와 다릅니다. 보안 설정 해제·자체 서명 루트 인증서 강제 신뢰를 요구하지 않습니다.
- 사용자가 보고한 간헐 실행 오류는 실제 오류 문구/로그가 없어 아직 원인 미확정입니다. GPU 전체 비활성화나 사용자 프로필 삭제는 하지 않습니다.

## 문서 끝 표·코드블록 입력 (1.0.2)
- ProseMirror 플러그인이 마지막 표·코드·Mermaid/HTML 미리보기 뒤에 편집 가능한 빈 문단을 유지합니다. 보이지 않는 문자나 HTML 자리표시자를 저장하지 않습니다.
- 기존 최종 문단은 중복하지 않고 입력·원문 동기화·Undo/Redo 및 4언어×렌더링/분할 모드를 검사합니다.
- bundle.cjs와 설치 검증의 원본 해시는 저장소 루트 index.html 기준입니다. source/editor.html은 과거 스냅샷이며 빌드에 사용하지 않습니다.
- tests/rendered-tail.browser.js의 34개 합성 검사를 개발·설치 앱의 격리 스모크에서 실행합니다. 결과 renderedTailBrowser가 누락·실패하면 CI도 실패합니다. 일반 시작과 사용자 프로필에서는 실행하지 않습니다.
