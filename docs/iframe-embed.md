# iframe 호스트 저장 연동

## 초기화
`mde:ready`를 받은 직접 부모가 실제 편집기 origin을 targetOrigin으로 지정하여 다음을 전송합니다.

```js
frame.contentWindow.postMessage({type:"mde:config",name:"회의록.md",saveLabel:"EMM에 저장"}, editorOrigin);
frame.contentWindow.postMessage({type:"mde:set",markdown:loadedMarkdown}, editorOrigin);
frame.contentWindow.postMessage({type:"mde:mode",mode:"rendered"}, editorOrigin);
```

iframe은 목차를 접고 시작합니다. 목차 단추로 다시 펼칠 수 있습니다. 파일·저장·닫기는 첫 줄 오른쪽의 같은 묶음에 고정됩니다. 좁아진 보기 선택 영역은 가로로 스크롤할 수 있습니다. 일반 탭·데스크톱의 기본 목차는 변경하지 않습니다.

## 저장
설정된 iframe의 저장 단추·파일 메뉴 저장·Ctrl+S·Cmd+S는 PC 파일 저장이 아니라 부모에게 `{type:"mde:save",markdown}`를 보냅니다. 부모는 반드시 `event.source === frame.contentWindow`와 실제 editorOrigin을 확인하고, 해당 첨부의 저장이 성공한 다음에만 응답합니다.

```js
// event.data.type === "mde:save" 또는 기존 "mde:change" 자동저장
const savedMarkdown = event.data.markdown;
await saveTheAttachment(savedMarkdown);
frame.contentWindow.postMessage({type:"mde:saved", markdown:savedMarkdown}, editorOrigin);
```

요청한 최소 형식 `{type:"mde:saved"}`도 지원합니다. 명시적 저장은 한 번에 한 요청만 보내며, 응답 전 최신 내용을 저장 완료로 취급하지 않습니다. 저장 중 추가 편집하면 이전 스냅샷의 응답 뒤에도 최신 내용은 dirty로 남습니다. 실패는 `{type:"mde:saved",ok:false}`로 알리면 dirty를 유지하고 재시도할 수 있습니다.

**자동저장 등 비동기 저장에는 응답에 실제 저장한 `markdown`을 함께 보내는 형식을 권장합니다.** 식별 정보가 없는 bare 응답만으로는 겹치거나 역순으로 도착한 자동저장 응답을 구분할 수 없습니다. 부모의 실제 저장 쓰기도 직렬화하고 마지막 내용이 마지막에 저장되도록 해야 합니다. 저장 실패 시 성공 응답을 보내지 않습니다.

성공 응답은 저장한 스냅샷을 baseline으로 만듭니다. 현재 내용과 같으면 dirty·닫기 확인·beforeunload 경고를 해제하고, 다르면 새 변경을 유지합니다. 단순 설정 변경만으로는 dirty를 해제하지 않습니다. 초기 `mde:set`은 부모에서 로드한 baseline입니다. 내 PC로 명시적으로 내보내는 파일 메뉴는 유지하지만, 내보내기를 EMM 저장 완료로 간주하지 않습니다.

## 경계와 보안
- 직접 iframe 부모만 이 API를 사용할 수 있고 첫 config의 origin을 고정합니다. 새 부모 origin으로 바꾸려면 iframe을 다시 만듭니다. sandbox의 opaque origin은 WindowProxy의 직접 부모 검증을 유지하며 응답 targetOrigin만 `*`를 사용합니다.
- iframe은 일반 웹 편집기의 localStorage 문서 캐시를 읽거나 덮어쓰지 않습니다. 언어·테마·보기 설정은 기존 동작을 보존합니다.
- 기존 EMM `src=opener&key=...`의 same-origin/key/reqId 저장과 서버 첨부 모드는 별도 경로로 보존하며 새 config로 전환하지 않습니다.
- EMM 앱 내부 사본은 별도 교체·통합·배포해야 합니다. EMM 커스텀 보안·인증·저장 bridge를 공통 HTML로 무조건 덮어쓰지 마세요. 부모 저장·첨부 선택 및 맵 저장의 실제 완료는 EMM 측에서 확인해야 합니다.

## 검사
`tests/embed-host.browser.js`는 합성 부모 `#embedTest`, `#embedEditor`, `mdData.data-name=cursor-regression...`에서만 실행합니다. 실제 첨부에는 실행하지 않습니다. 일반 문서와 기존 표·코드 마지막 커서의 회귀 검사는 별도로 유지합니다.
