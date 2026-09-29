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

관리자 프로젝트는 `admin/vercel.json`의 rewrite로 `/admin/home`, `/admin/models`, `/admin/settings`, `/admin/books/<책 id>`(끝의 `/` 포함)도 관리자 화면에 연결합니다. 이 주소에서 새로고침해도 같은 화면이 열립니다. 주소 규칙은 [관리자 안내](ADMIN-GUIDE.md#주소와-새로고침)를 참고하세요.

## 환경변수

| 프로젝트 | 변수 | 미리보기(Preview) | 운영(Production) |
| --- | --- | --- | --- |
| 두 프로젝트 | `DEPLOYMENT_APP` | `client` / `admin` | `client` / `admin` |
| 두 프로젝트 | `SUPABASE_URL` | `https://razpvjtsmaoizjbtpxqs.supabase.co` | 미리보기와 같은 값 |
| 두 프로젝트 | `SUPABASE_SERVICE_ROLE_KEY` | on-the-project의 service_role 키 | 미리보기와 같은 값 |
| 관리자 | `ADMIN_PASSWORD` | 필수 | 필수 |
| 관리자 | `VITE_CLIENT_URL` | 기존 값 | `https://on-the-book-client.vercel.app/` |

`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`는 비밀값이므로 Vercel 대시보드나 `vercel env add` 입력 창에서 직접 입력합니다. `VITE_CLIENT_URL`은 빌드할 때 관리자 화면에 들어가므로, 값을 바꾸면 관리자 프로젝트를 다시 배포해야 합니다. 예전의 `BLOB_READ_WRITE_TOKEN`, `BLOB_NAMESPACE`는 더 쓰지 않습니다.

## 저장과 로그인

로컬 서버, 미리보기, 운영이 모두 Supabase 프로젝트 on-the-project(`razpvjtsmaoizjbtpxqs`, 도쿄) 하나를 씁니다. 구조는 `supabase/migrations`에 있습니다.

- 관리 항목은 표 한 줄에 하나씩 들어갑니다. `books`·`chapters`·`placements`·`models`·`hero_slides`가 편집본이고, "사용자 화면에 공개"를 누를 때마다 그 시점의 책장이 `publications`에 남습니다. 독자 화면은 가장 최근 공개본을 읽고, 공개본은 최근 30개까지 보관합니다.
- 저장과 공개는 DB 함수 `save_draft` 하나가 한 트랜잭션으로 처리합니다. 저장 버전(`library_state.version`)이 다르면 거부해 동시 저장을 막습니다. 대시보드에서 표를 직접 고쳐도 버전이 올라가므로, 그 전에 열린 관리자 창의 저장은 새로고침을 요청합니다. 서버의 저장 형식 번호(`SCHEMA_VERSION`)가 DB에 기록된 것보다 낮으면 저장을 거부합니다.
- 파일은 저장소 버킷에 둡니다. `uploads`(비공개, 파일당 25MB)는 앱이 쓰는 GLB·PNG와 소개 페이지 여정 모델·사진, `archive`(비공개, 파일당 50MB)는 블렌더 원본과 도면입니다. 파일마다 `assets` 표에 크기·SHA-256·딸린 항목(`model:…`, `book:…`, `site:…`)과 GLB의 뼈대·동작 정보가 남습니다. 저장할 때 모델 파일을 내려받지 않고 이 기록으로 확인합니다.
- 소개 페이지 여정 모델은 `site_assets`의 `about-journey` 행이 모델·사진 주소와 경로 데이터를 담고, `/api/site/about-journey`로 누구나 읽습니다.
- 로그인 세션은 `sessions` 표에 8시간 동안 남습니다.

모든 표는 행 수준 보안(RLS)을 켜고 허용 규칙을 두지 않았습니다. 서버만 service_role 키로 접근하며, 이 키는 서버 환경에만 등록하고 프런트엔드에 전달하지 않습니다. 공개용 anon 키로는 표·함수·파일 어디에도 접근할 수 없습니다.

2026-09-28에 운영 Blob(`prod/`)의 편집본·공개본과 파일 10개를 `scripts/migrate-blob-to-supabase.mjs`로 옮겼습니다. 스크립트는 되읽은 편집본·공개본이 원본과 같은지, 파일마다 SHA-256이 같은지 확인했습니다. 같은 날 소개 페이지 여정 자료를 `client/about/assets`에서, 블렌더 원본과 도면을 작업 폴더에서 저장소로 옮겼습니다. Blob 저장소의 옛 데이터는 백업으로 남겨 두었고, 미리보기 구역(접두어 없음)의 데이터는 옮기지 않았습니다.

같은 날 앨리스·오즈가 쓰던 코드로 그린 기본 모델 9종(`rabbit`·`mushroom`·`teapot`·`tree`·`rose`·`key`·`clock`·`cards`·`house`)을 같은 ID의 GLB로 바꾸고 공개했습니다. 원본은 91~95점으로 검수를 통과한 블렌더 파일(`Desktop/workspace/blender-modeling`)이며, `scripts/blender/export-web-glb.py`로 내보내 관리자 업로드 경로로 올렸습니다. 원본 `.blend`는 `archive` 버킷의 `blender/alice/`에 있습니다. 독자 화면은 GLB의 가장 긴 변을 2로 맞추므로, 배치 24개의 배율은 예전 모델 크기에 맞춰 보정했고 충돌 반경은 월드 기준 크기가 그대로이도록 함께 조정했습니다. 시험용 시드 데이터(`server/seed.js`)는 여전히 코드로 그린 모델을 씁니다.

관리자 프로젝트는 `ADMIN_PASSWORD`를 반드시 설정해야 합니다. 누락되면 로그인과 수정 요청을 거부합니다. 사용자 프로젝트에서는 관리자 API를 허용하지 않고 `/api/library`, `/api/site/…`, `/uploads/…` 읽기만 받습니다. 미공개 파일은 관리자 세션이 있어야 다운로드할 수 있습니다. 파일 전달에는 10분간 유효한 서명 주소를 사용합니다.

PNG 5MB, GLB 25MB 제한을 유지합니다. Vercel에서는 브라우저가 Supabase의 서명 업로드 주소로 파일을 `uploads/staging/`에 직접 보내고, 서버가 내용을 검증한 후 등록합니다. 로컬 서버는 파일을 직접 받아 같은 검증을 거친 뒤 저장소에 올립니다. 저장할 때는 초안에 새로 등장한 이미지만 등록 기록이 있는지 확인하며, 없으면 저장을 거부합니다.

사용자 프로젝트는 공개된 책장 응답(`server/publication.js`)이 가리키는 업로드 파일만 내보냅니다. 공개 대상 책의 표지·바닥 그림·장면 썸네일, 사용 중인 모델, 공개 대상 책에 연결된 히어로 사진이 여기에 해당합니다. PNG 이미지는 다운로드 주소로 넘길 때 브라우저가 5분간 보관하도록 허용합니다. 그래서 책을 비공개로 돌려도 이미 본 브라우저에는 이미지가 최대 5분 남을 수 있습니다. GLB는 보관하지 않습니다.

### 홈 화면 관리 데이터

분류(`book.category`), 장면 썸네일(`chapter.thumbnail`), 홈 화면 슬라이드(`home.hero`)가 비어 있으면 서버와 사용자 화면이 기본값으로 처리해 이전과 같은 화면(도서 보관함 앞 두 권의 히어로, 앨리스 ‘판타지’·오즈 ‘모험’ 분류)을 보여 줍니다.

로컬·미리보기·운영이 한 DB를 쓰므로, 어느 곳의 관리자에서 저장하든 같은 데이터가 바뀌고 공개하면 운영 사용자 화면에 바로 반영됩니다. Supabase로 옮기기 전의 옛 브랜치는 Blob을 쓰므로 이 DB를 바꾸지 못합니다. 앞으로 저장 형식을 바꿀 때는 `server/storage.js`의 `SCHEMA_VERSION`을 올려, 새 항목을 모르는 옛 관리자가 저장하면서 그 항목을 지우지 못하게 합니다.

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

3. 배포가 끝나면 확인합니다. 사용자 화면의 `/`, `/about`, `/api/library`는 200, 관리자 화면의 `/admin/`, `/admin/models`, `/admin/books/<아무 책 id>`는 200, `/admin/zzz`는 404, 로그인하지 않은 `/api/studio`는 401, 관리자 화면의 `/about`은 404여야 합니다.

git 저장소 폴더에서 바로 `vercel deploy --prod`를 실행하면, 배포에 붙는 커밋 작성자가 Vercel 계정과 다를 때 배포가 빌드를 시작하지 않고 멈출 수 있습니다. 2026-09-23에 이렇게 멈춘 배포는 CLI에서 상태가 `UNKNOWN`, 화면은 "Deployment is building"으로 남았고, git 정보 없이 내보낸 폴더에서는 바로 빌드됐습니다. 멈춘 배포는 운영에 연결되지 않으므로 `vercel remove <배포 주소> --yes`로 지웁니다.

## 확인

`npm test`, `npm run build:client`, `npm run build:admin`으로 기본 검사를 실행합니다. 실제 Supabase 연결 검사는 `node --env-file=.env tests/supabase.mjs`로 실행합니다. Vercel과 같은 방식으로 로그인·동시 저장 거부·6MB 모델 직접 업로드·사용자 화면 격리·로그아웃을 확인합니다. 편집본은 내용 없이 두 번 저장되어 버전만 오르고, 올린 시험 모델은 끝에 지웁니다. 공개 파일 허용 목록은 `tests/publication.test.js`가 `npm test` 안에서 검사합니다.

배포한 뒤에는 관리자에서 표지·장면 썸네일·히어로 사진이 있는 책을 공개합니다. 그다음 사용자 화면에서 이미지가 보이는지, 브라우저 개발자 도구의 네트워크 탭에서 `/uploads/` 요청이 404 없이 307 뒤 200으로 끝나는지 확인합니다.
