# Markdown Editor 홈페이지 배포

- GitHub: https://github.com/okpojung/markdown-editor
- 홈페이지: http://md-editor.baro.me (TLS는 외부 NPM 프록시에서 종료)
- Coolify: https://coolify.baro.me
- 프로젝트: markdown-editor / production
- 빌드: Dockerfile, GitHub 저장소 루트 `/`, Dockerfile 경로 `/Dockerfile.homepage`, 서비스 포트 80. 로컬 기록용 루트에서 직접 빌드하지 말고 최신 GitHub 파일로 구성한 repo-worktree/ 컨텍스트를 사용한다.
- `/`: site/ 랜딩페이지
- `/editor/`: root index.html 사본. EMM 코드 원본은 변경하지 않는다.
- `/downloads/markdown-editor.html`: 편집기 단일 HTML 내려받기. 실행 시 CDN 통신 필요. 완전 오프라인 파일은 편집기 파일 메뉴에서 별도로 만든다.
- `/health`: 200 `ok`
- 독립 서비스 사본의 appMain 스크립트 선두에만 standalone-guard.js를 인라인 삽입해(다시 저장하는 md.html에도 보호 유지) mde 메시지의 출처/송신자 제한. 보안 헤더로 제3자 iframe 및 교차 출처 opener 차단.
- DNS A md-editor.baro.me -> 외부 NPM IP(현재 값을 관리자 화면에서 재확인). NPM proxy -> Coolify 192.168.94.71:80. 새 호스트만 추가하며 기존 호스트/전역 설정은 수정하지 않는다.
- 별도 계정/DB/분석 추적 없음. worklogs/ 및 원본 사용자 프롬프트는 이미지·공개 저장소에 포함하지 않는다.
- 자동배포 웹훅은 검증 전 사용하지 않는다. 이 환경은 과거 외부 프록시가 GitHub 웹훅을 403 차단한 이력이 있다.
- 로컬 미리보기: `node scripts/preview-server.cjs`, http://localhost:4173
- 되돌리기: Coolify에서 이전 성공 배포를 재배포한다. 원본 편집기 index.html과 EMM 서비스는 이 홈페이지 배포와 별도다.
