# 분리 배포

동일한 GitHub 저장소를 Vercel 프로젝트 두 개에 연결합니다.

| 항목 | 사용자 화면 | 관리자 화면 |
| --- | --- | --- |
| 프로젝트 | on-the-book-client | on-the-book-admin |
| 운영 주소 | https://on-the-book-client.vercel.app | https://on-the-book-admin.vercel.app |
| Root Directory | client | admin |
| Install Command | cd .. && npm ci | cd .. && npm ci |
| Build Command | cd .. && npm run build:client | cd .. && npm run build:admin |
| Output Directory | ../dist/client | ../dist/admin |
| DEPLOYMENT_APP | client | admin |

두 프로젝트 모두 Root Directory 바깥의 소스 포함을 켭니다. 사용자 빌드에는 관리자 화면이 포함되지 않습니다. 관리자 빌드의 `/client/`는 로그인 쿠키를 유지하는 임시 저장 미리보기입니다. 공개 화면 이동은 `VITE_CLIENT_URL`을 사용합니다. 사용자 프로젝트는 `/about`, `/about/`, `/client/about/`을 소개 페이지로 연결하며, 관리자 빌드에는 소개 페이지가 포함되지 않습니다.

## 환경변수

| 프로젝트 | 변수 | 미리보기(Preview) | 운영(Production) |
| --- | --- | --- | --- |
| 두 프로젝트 | `DEPLOYMENT_APP` | `client` / `admin` | `client` / `admin` |
| 두 프로젝트 | `BLOB_READ_WRITE_TOKEN` | 공용 Blob 저장소 토큰 | 미리보기와 같은 토큰 |
| 두 프로젝트 | `BLOB_NAMESPACE` | 없음 | `prod/` |
| 관리자 | `ADMIN_PASSWORD` | 필수 | 필수 |
| 관리자 | `VITE_CLIENT_URL` | 기존 값 | `https://on-the-book-client.vercel.app/` |

`BLOB_READ_WRITE_TOKEN`, `ADMIN_PASSWORD`는 비밀값이므로 Vercel 대시보드나 `vercel env add` 입력 창에서 직접 입력합니다. `VITE_CLIENT_URL`은 빌드할 때 관리자 화면에 들어가므로, 값을 바꾸면 관리자 프로젝트를 다시 배포해야 합니다.

## 저장과 로그인

두 프로젝트는 같은 비공개 Blob 저장소를 사용합니다. `BLOB_READ_WRITE_TOKEN`은 서버 환경에만 등록하며 프런트엔드에 전달하지 않습니다. 책장은 `library.json`, 업로드 파일은 `uploads/`, 업로드 임시 파일은 `staging/`, 로그인 세션은 `sessions/`에 보관됩니다. 운영은 `BLOB_NAMESPACE=prod/`로 이 모든 경로를 `prod/` 아래에 따로 두므로, 미리보기에서 편집하거나 공개해도 운영 데이터는 바뀌지 않습니다. 로컬 실행은 기존 `data` 폴더를 계속 사용합니다.

운영 저장소는 2026-09-23에 빈 상태로 시작했습니다. `prod/library.json`이 없으면 서버는 기본 예시 책장(이상한 나라의 앨리스, 오즈의 마법사)을 보여 주고, 관리자에서 처음 저장하거나 공개할 때 운영 데이터가 만들어집니다. 미리보기 데이터와 업로드한 모델은 운영으로 자동 복사되지 않습니다.

관리자 프로젝트는 `ADMIN_PASSWORD`를 반드시 설정해야 합니다. 누락되면 로그인과 수정 요청을 거부합니다. 사용자 프로젝트에서는 관리자 API를 허용하지 않습니다. 미공개 파일은 관리자 세션이 있어야 다운로드할 수 있습니다. 파일 전달에는 10분간 유효한 다운로드 주소를 사용합니다.

PNG 5MB, GLB 25MB 제한을 유지합니다. 브라우저에서 비공개 임시 저장소로 직접 전송하고 서버에서 내용을 검증한 후 등록합니다. 동시 저장은 저장소의 ETag 조건 검사로 충돌을 감지합니다. 저장할 때는 초안에 새로 등장한 이미지만 저장소에 있는지 확인하며, 없으면 저장을 거부합니다.

사용자 프로젝트는 공개된 책장 응답(`server/publication.js`)이 가리키는 업로드 파일만 내보냅니다. 공개 대상 책의 표지·바닥 그림·장면 썸네일, 사용 중인 모델, 공개 대상 책에 연결된 히어로 사진이 여기에 해당합니다. PNG 이미지는 다운로드 주소로 넘길 때 브라우저가 5분간 보관하도록 허용합니다. 그래서 책을 비공개로 돌려도 이미 본 브라우저에는 이미지가 최대 5분 남을 수 있습니다. GLB는 보관하지 않습니다.

### 홈 화면 관리 데이터

분류(`book.category`), 장면 썸네일(`chapter.thumbnail`), 홈 화면 슬라이드(`home.hero`)는 새 관리자에서 한 번 저장하거나 공개해야 저장소 데이터에 생깁니다. 그 전에는 서버와 사용자 화면이 빠진 항목을 기본값으로 처리해 이전과 같은 화면(도서 보관함 앞 두 권의 히어로, 앨리스 ‘판타지’·오즈 ‘모험’ 분류)을 보여 줍니다.

미리보기 배포는 모두 같은 저장소를 씁니다. 이 기능이 없는 옛 브랜치의 미리보기 관리자에서 저장하면, 그 버전이 모르는 분류·장면 썸네일·홈 화면 슬라이드가 빠진 채 저장되어 지워집니다. 새 항목을 쓰기 시작한 뒤에는 옛 미리보기 관리자에서 저장하지 마세요. 운영은 `prod/` 아래에 따로 저장되므로 영향을 받지 않습니다.

## 미리보기와 운영 배포

PR과 `main` 이외 브랜치의 푸시는 GitHub 연동으로 미리보기에 배포됩니다. `main` 푸시가 운영 배포를 자동으로 만들지 않도록 각 `vercel.json`에서 `main` 자동 배포를 꺼 두었으므로, 운영은 필요할 때 Vercel CLI로 직접 배포합니다. 첫 운영 배포는 2026-09-23에 `main`의 `9a8f5c1`로 했습니다.

운영 배포 순서입니다. 사용자 화면을 먼저 배포하고 관리자 화면을 배포합니다.

1. 빈 폴더 두 개에 `main`을 git 정보 없이 내보냅니다. 저장소 폴더에서 Git Bash 같은 bash 셸로 실행합니다(Windows PowerShell 5.1의 파이프는 tar 데이터를 깨뜨립니다).

   ```bash
   git archive --format=tar main | tar -x -C <사용자용-빈-폴더>
   git archive --format=tar main | tar -x -C <관리자용-빈-폴더>
   ```

2. 각 폴더에서 프로젝트를 연결하고 운영으로 배포합니다. `vercel link`가 만든 `.env.local`에는 개발 환경변수가 들어 있으므로 배포 전에 지웁니다.

   ```bash
   vercel link --yes --project on-the-book-client --scope bucheongosok-gmailcoms-projects
   rm .env.local
   vercel deploy --prod --archive=tgz
   ```

   관리자용 폴더에서는 `on-the-book-admin`으로 같은 명령을 실행합니다.

3. 배포가 끝나면 확인합니다. 사용자 화면의 `/`, `/about`, `/api/library`는 200, 관리자 화면의 `/admin/`은 200, 로그인하지 않은 `/api/studio`는 401, 관리자 화면의 `/about`은 404여야 합니다.

git 저장소 폴더에서 바로 `vercel deploy --prod`를 실행하면, 배포에 붙는 커밋 작성자가 Vercel 계정과 다를 때 배포가 빌드를 시작하지 않고 멈출 수 있습니다. 2026-09-23에 이렇게 멈춘 배포는 CLI에서 상태가 `UNKNOWN`, 화면은 "Deployment is building"으로 남았고, git 정보 없이 내보낸 폴더에서는 바로 빌드됐습니다. 멈춘 배포는 운영에 연결되지 않으므로 `vercel remove <배포 주소> --yes`로 지웁니다.

## 확인

`npm test`, `npm run build:client`, `npm run build:admin`으로 기본 검사를 실행합니다. 실제 Blob 연결 검사는 `BLOB_READ_WRITE_TOKEN`을 환경에 설정하고 `node tests/cloud.mjs`로 실행합니다. 검사는 매번 고유한 `verification/` 경로만 사용하고 생성한 파일을 정리합니다. 공개 파일 허용 목록은 `tests/publication.test.js`가 `npm test` 안에서 검사합니다.

배포한 뒤에는 관리자에서 표지·장면 썸네일·히어로 사진이 있는 책을 공개합니다. 그다음 사용자 화면에서 이미지가 보이는지, 브라우저 개발자 도구의 네트워크 탭에서 `/uploads/` 요청이 404 없이 307 뒤 200으로 끝나는지 확인합니다.
