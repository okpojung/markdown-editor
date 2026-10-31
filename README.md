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

`postMessage`로 문서를 주고받습니다: `mde:set`, `mde:get` → `mde:markdown`, `mde:mode`, 변경 시 `mde:change`, 닫기 시 `mde:close`.
실서비스에 붙일 때는 허용할 출처(origin)만 받도록 바꿔야 합니다.

## 라이선스

[MIT](LICENSE) © 2026 okpojung
