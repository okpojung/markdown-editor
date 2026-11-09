<p align="center"><img src="assets/logo.svg" width="120" alt="markdown-editor logo"></p>

# markdown-editor

브라우저에서 바로 쓰는 마크다운 편집기입니다. 설치나 서버 없이 `index.html` 하나로 동작합니다.

## 주요 기능

- **보기 4가지**: 마크다운 원문 / 아웃라인 / 렌더링 / 분할(원문 + 렌더링, 양쪽 모두 편집·자동 동기화)
- **분할 창 크기 조절**: 가운데 막대를 끌어서 조절, 더블클릭하면 반반
- **왼쪽 목차**: 접기/펼치기, 누르면 해당 제목으로 이동
- **아웃라인 편집**: Enter 새 항목, Tab/Shift+Tab 들여쓰기, Alt+↑↓ 이동, 끌어서 이동, Ctrl+Z/Y
- **편집 도구 한 줄**: 제목(H1~H6), 굵게·기울임·취소선·밑줄·하이라이트, 글머리·번호·체크박스, 링크, 인라인 코드, 코드 블록, 표 — 커서가 있는 창(원문 또는 렌더링)에 적용
- **표 편집기**: 격자/MD 전환, 행·열 추가·삭제, 열 정렬, 셀 안 줄바꿈(`<br>`)
- **코드 블록 팝업**: 언어 목록(67개)·자동 완성, 줄 번호, 복사, Ctrl+Enter
- **Mermaid·HTML 미리보기**: ` ```mermaid `는 다이어그램으로, ` ```html `은 격리된 창(sandbox iframe)에서 보여 줌. 더블클릭하면 코드 편집
- **VS Code 색 테마**: Light+ / Dark+ / Light Modern / Dark Modern, 항목별 색 직접 변경, 글꼴 크기, 줄바꿈
- **밑줄·하이라이트 문법 선택**: HTML(`<u>`, `<mark>`) 또는 EasyMindMap 방식(`__`, `==`)

## 파일 메뉴

| 메뉴 | 설명 |
|---|---|
| 새 문서 / 열기 / 예제 문서 | `.md`, `.markdown`, `.txt`, `.md.html` 열기 |
| 저장 (Ctrl+S) | 지금 형식 그대로 저장 |
| 다른 이름으로 저장 | 지금 형식으로 새 이름 저장 |
| .md로 저장 | 순수 마크다운 파일 |
| md.html(온라인)로 저장 | 편집기 + 원문이 든 HTML 한 파일(약 110KB). 열 때 인터넷 필요 |
| md.html(오프라인)로 저장 | 라이브러리까지 넣은 HTML 한 파일(약 1.2MB, Mermaid가 있으면 약 4.7MB). 인터넷 없이 열고 편집 가능. 만들 때만 인터넷 필요 |
| 닫기 | 저장 안 된 변경이 있으면 확인. 브라우저가 탭 닫기를 막으면 빈 문서로 바뀜 |

`파일명.md.html`을 브라우저로 열면 원문·렌더링 화면으로 보고 편집할 수 있습니다.
Chrome·Edge에서는 처음 저장할 때 파일 위치를 고르면 그다음부터 같은 파일에 바로 덮어씁니다. 다른 브라우저는 내려받기 폴더에 새 파일로 저장됩니다.

## 파일 구성

| 경로 | 내용 |
|---|---|
| `index.html` | 편집기 |
| `lib/` | TOAST UI Editor 3.2.2 번들 사본(MIT). 오프라인 파일을 만들 때 jsDelivr로 받습니다 |
| `samples/` | 예제 md.html (온라인·오프라인) |
| `docs/` | 아웃라인 시험 문서와 시험 절차 |

## 사용한 오픈소스

- [CodeMirror 5](https://codemirror.net/5/) (MIT) — 원문 편집
- [TOAST UI Editor 3](https://github.com/nhn/tui.editor) (MIT) — 렌더링 편집
- [Mermaid](https://mermaid.js.org/) (MIT) — 다이어그램
- 색 값: VS Code 기본 테마(`extensions/theme-defaults`)

## EasyMindMap 연동

`index.html?att=<첨부 id>&api=<API 주소>&name=<파일명>`으로 열면 EasyMindMap 첨부(.md)를 불러오고, `EMM에 저장`(Ctrl+S)으로 같은 첨부에 저장합니다(`PUT /v1/attachments/:id/content`, `If-Match: "sha256:…"` 충돌 검사). 토큰은 같은 출처의 `localStorage["emm.auth"]` 또는 `#t=`로 받습니다.

## 임베드(iframe)

직접 부모의 `mde:config {name,saveLabel}`로 파일 이름과 저장 단추를 설정합니다. 그 모드의 저장·Ctrl/Cmd+S는 `mde:save {markdown}`를 부모에게 보내며, 실제 저장 성공 후 `mde:saved` 응답으로 저장 상태를 확정합니다. 기존 set/get/mode/change/close API는 유지합니다. iframe은 기본 목차를 접고 파일·저장·닫기를 첫 줄에 배치합니다. [연동 계약·저장 동시성·보안 및 검사](docs/iframe-embed.md)를 참고하세요.

## 라이선스

[MIT](LICENSE) © 2026 okpojung


## 홈페이지 언어 선택

[홈페이지](https://md-editor.baro.me/)와 [왜 Markdown?](https://md-editor.baro.me/why-markdown/)는 한국어·영어·일본어·중국어(간체)를 지원합니다. 상단 국기/언어 버튼을 누르고 언어를 선택하세요. 현재 선택에는 체크가 표시됩니다.

- [한국어](https://md-editor.baro.me/?lang=ko) · [English](https://md-editor.baro.me/?lang=en) · [日本語](https://md-editor.baro.me/?lang=ja) · [中文](https://md-editor.baro.me/?lang=zh)
- 주소의 `lang` 선택이 우선이며, 없으면 이전 선택을 기억합니다. 저장된 선택도 없으면 한국어로 표시합니다. 브라우저 언어에 따라 자동 이동하지 않습니다.
- 홈/상세페이지를 이동해도 언어가 유지됩니다. 제목·설명·본문·체험 UI·접근성 이름을 함께 바꿉니다. 기사 원제·출처명은 인용 정확성을 위해 원문을 유지합니다.
- 언어 메뉴는 방향키, Home/End, Enter, Escape로 조작할 수 있습니다. 외부 기사, GitHub, 편집기는 안전한 새 탭으로 열립니다.
- 언어 전환에는 JavaScript가 필요합니다. 홈페이지에서 편집기를 열면 현재 언어를 전달합니다. 편집기에서도 한국어·영어·일본어·중국어(간체)를 지원하며, 설정 → 편집기 언어에서 변경할 수 있습니다.


## 편집기 언어 설정

- 상단의 국기 버튼 또는 **설정 → 편집기 언어**에서 한국어 / English / 日本語 / 简体中文을 선택합니다.
- 홈페이지의 **편집기 열기**는 현재 홈페이지 언어를 `?lang=ko|en|ja|zh`로 전달합니다. 명시된 주소 언어는 편집기의 이전 선호보다 우선합니다.
- 변경한 언어는 편집기 선호값으로 저장합니다. 문서 본문·코드·파일명은 번역하지 않습니다.
- 언어 전환 시 문서·미저장 표시·원문 선택/실행 취소 기록·테마를 유지합니다. 렌더링 창의 내부 실행 취소 기록은 재생성으로 초기화되며, 설정창에도 안내합니다.
- 온라인/오프라인 md.html에도 4언어 UI와 언어 설정을 포함합니다.
- [상세 안내](docs/editor-i18n.md). 이 저장소 변경은 EMM 앱의 사본 교체나 배포를 수행하지 않습니다.


## Electron 설치형 앱

Windows x64(.exe), macOS Intel/Apple Silicon(.dmg), Linux x64(.deb/AppImage)를 별도의 `desktop/` 앱으로 빌드합니다. 4언어 UI·오프라인 라이브러리·네이티브 파일 열기/저장을 포함합니다.

- [빌드·설치 안내](desktop/README.md)
- [Desktop installers 빌드 및 다운로드](https://github.com/okpojung/markdown-editor/actions/workflows/desktop-build.yml)
- 각 성공한 플랫폼 작업의 artifact에 설치 파일·SHA256SUMS·설치 실행 검사 결과와 의존성 lock을 보관합니다. 기본 보관은 14일입니다.
- Windows 퍼블리셔 서명과 macOS Developer ID/공증은 미설정입니다(macOS는 ad-hoc). 정식 배포 전 별도 서명 설정이 필요합니다.
- 데스크톱 앱은 별도 배포이며 웹 편집기와 EMM 앱 사본을 자동 교체하지 않습니다.

## 설치 파일 다운로드

[홈페이지 다운로드](https://md-editor.baro.me/?lang=ko#download)와 [GitHub Release v1.0.3](https://github.com/okpojung/markdown-editor/releases/tag/v1.0.3)에서 Windows x64, macOS Intel/Apple Silicon, Linux x64 DEB/AppImage를 선택합니다. SHA256SUMS.txt는 설치 파일 5종을 검증합니다.

[검증한 빌드 소스](https://github.com/okpojung/markdown-editor/tree/984ae333bb37482e9ed745eab872fd0f66ebeaf7)와 [4플랫폼 CI](https://github.com/okpojung/markdown-editor/actions/runs/42436179534). 각 설치 앱에서 표 격자 52개·기존 표/코드 34개 회귀 검사를 통과했습니다. [릴리스 준비 검증](https://github.com/okpojung/markdown-editor/actions/runs/42436840895)은 main과 전체 tree 일치 및 5파일의 바이트 수·SHA-256을 확인했습니다. Windows 별도 표준 계정 실행은 미검증이며 Windows Authenticode와 macOS Developer ID 서명·공증도 미완료입니다. AppImage의 FUSE 실구동은 미검증입니다. EMM 운영 사본 반영은 별도 확인해야 합니다.

## 문서 끝 표·코드블록 커서 수정
표·일반 코드블록·Mermaid/HTML 미리보기로 끝나는 문서에서 블록 아래에 커서를 놓고 계속 입력할 수 있습니다. 기존 마지막 문단은 중복 추가하지 않습니다. 공통 원본 index.html을 웹·데스크톱 빌드에 사용하며 tests/rendered-tail.browser.js로 4언어·렌더링/분할·원문 동기화·Undo/Redo 34개 합성 검사를 제공합니다. EMM 사본은 앱 담당이 동일 커밋을 반영해야 합니다.


## 표 크기 격자 선택
새 표는 표 단추에서 10열×8행 격자를 가리켜 크기를 확인한 뒤 클릭해 바로 삽입합니다. 행 수는 머리글을 포함하며 모든 칸은 비어 있습니다. 화살표·Home/End로 크기 선택, Enter/Space로 삽입, Escape로 취소할 수 있습니다. 더 큰 표나 상세 설정은 자세히 설정을 사용합니다. 기존 표 안에서 표 단추를 누르면 기존 상세 편집창으로 열립니다. 웹·내보낸 HTML·데스크톱이 같은 원본을 사용하며 tests/table-grid.browser.js의 격리 검사로 4언어·4편집 경로와 취소·기존 표 보존을 확인합니다. EMM 사본 반영은 앱 배포와 별개로 확인해야 합니다.

## 분할 화면 스크롤·선택 위치 동기화

원문과 렌더링 어느 쪽을 스크롤하거나 커서를 선택해도 다른 쪽의 대응 블록을 표시합니다. 문서 전체 스크롤 비율 대신 Markdown AST의 블록 위치를 사용하며 상대 창의 커서·선택·포커스·문서는 변경하지 않습니다. 분할 화면에서만 작동하고 언어/문서 교체·편집 후 위치 매핑을 갱신합니다. `tests/split-scroll.browser.js`는 4언어와 양방향 스크롤·선택·끝 이동·재생성·편집 및 긴 링크가 포함된 표 머리글·본문 셀 60개 검사를 제공하고 데스크톱 빌드 및 게시 증거에도 포함합니다. EMM 사본은 담당 세션의 별도 반영·검증이 필요합니다.
