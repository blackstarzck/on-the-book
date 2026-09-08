# 분리 배포

동일한 GitHub 저장소를 Vercel 프로젝트 두 개에 연결합니다.

| 항목 | 사용자 화면 | 관리자 화면 |
| --- | --- | --- |
| 프로젝트 | on-the-book-client | on-the-book-admin |
| Root Directory | client | admin |
| Install Command | cd .. && npm ci | cd .. && npm ci |
| Build Command | cd .. && npm run build:client | cd .. && npm run build:admin |
| Output Directory | ../dist/client | ../dist/admin |
| DEPLOYMENT_APP | client | admin |

두 프로젝트 모두 Root Directory 바깥의 소스 포함을 켭니다. 사용자 빌드에는 관리자 화면이 포함되지 않습니다. 관리자 빌드의 `/client/`는 로그인 쿠키를 유지하는 임시 저장 미리보기입니다. 공개 화면 이동은 `VITE_CLIENT_URL`을 사용합니다.

## 저장과 로그인

Vercel에서는 두 프로젝트가 동일한 비공개 Blob 저장소를 사용합니다. `BLOB_READ_WRITE_TOKEN`은 서버 환경에만 등록하며 프런트엔드에 전달하지 않습니다. 책장은 `library.json`, 업로드 파일은 `uploads/`, 로그인 세션은 `sessions/`에 보관됩니다. 로컬 실행은 기존 `data` 폴더를 계속 사용합니다.

관리자 프로젝트는 `ADMIN_PASSWORD`를 반드시 설정해야 합니다. 누락되면 로그인과 수정 요청을 거부합니다. 사용자 프로젝트에서는 관리자 API를 허용하지 않습니다. 미공개 파일은 관리자 세션이 있어야 다운로드할 수 있습니다. 파일 전달에는 10분간 유효한 다운로드 주소를 사용합니다.

PNG 5MB, GLB 25MB 제한을 유지합니다. 브라우저에서 비공개 임시 저장소로 직접 전송하고 서버에서 내용을 검증한 후 등록합니다. 동시 저장은 저장소의 ETag 조건 검사로 충돌을 감지합니다.

## 현재 배포 범위

미리보기 환경에 배포합니다. `main` 푸시가 운영 배포를 자동으로 만들지 않도록 각 `vercel.json`에서 해당 브랜치의 자동 배포를 껐습니다. 운영 배포를 시작할 때 운영 환경의 저장소와 관리자 비밀번호를 별도로 설정하고 이 설정을 변경합니다. 현재 미리보기 저장소와 로컬 작업 데이터는 최초 복사 후 자동 동기화되지 않습니다.

## 확인

`npm test`, `npm run build:client`, `npm run build:admin`으로 기본 검사를 실행합니다. 실제 Blob 연결 검사는 `BLOB_READ_WRITE_TOKEN`을 환경에 설정하고 `node tests/cloud.mjs`로 실행합니다. 검사는 매번 고유한 `verification/` 경로만 사용하고 생성한 파일을 정리합니다.
