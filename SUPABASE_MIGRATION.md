# 말해농 Supabase 이전

이 변경은 기존 서비스가 계속 실행되는 상태에서 새 Supabase 백엔드를 검증하도록 준비한 코드입니다.
기본 `VITE_BACKEND_PROVIDER`는 `lovable`이며, 새 환경이 검증되기 전에는 변경하지 않습니다.

## 대상

- GitHub: `HyejoonJeong/farmland-friend`
- 새 Supabase: 말해농서비스팀 / `ertujxbknytbyuqgvcuy`
- 기존 Supabase: `kelgjjyyjqogrlqjcokc`
- Edge Function: `malhaenong-api`

| 새 API 경로 | 기능 | 기본 모델 |
| --- | --- | --- |
| `/functions/v1/malhaenong-api/intent` | 의도 분류 | `gpt-6-luna` |
| `/functions/v1/malhaenong-api/consult` | 농지은행·전수조사 상담 | `gpt-6-luna` |
| `/functions/v1/malhaenong-api/stt` | 녹음 파일 인식 | `gpt-transcribe` |
| `/functions/v1/malhaenong-api/tts` | 한국어 음성 합성 | `gpt-realtime-2.1-mini` / alloy |
| `/functions/v1/malhaenong-api/admin-logs` | 관리자 운영 데이터 | 모델 호출 없음 |
| `/functions/v1/malhaenong-api/health` | 연결 확인 | 모델 호출 없음 |

`consult`는 `domain: "farmland" | "survey"`로 자료와 답변 지침을 구분합니다.
기존 화면의 `/api/ask`, `/api/survey-ask` 호출은 클라이언트 어댑터가 이 API로 변환합니다.
의도 분류는 기존 추가 질문 흐름을 유지합니다. 형식·유효값 검증 실패에만 Sol을 한 번 사용하며,
모호한 민원을 Sol 호출로 강제 확정하지 않습니다. 답변 모델에 연락처를 추측시키지 않고 기존 연락처 행렬 조회를 유지합니다.

## 로컬 검증

Node.js, Bun, Deno를 설치한 환경에서 실행합니다. 기존 프로젝트의 `bun.lock`을 유지했습니다.

```sh
bun install --frozen-lockfile --ignore-scripts
bun run edge:sync
bun run edge:check
bun run test:backend
bun run test:schema
bun x tsc --noEmit
bun run build
```

Edge용 자료는 `src/lib/data.ts`, `clarify-flow.ts`, `fbo-knowledge.ts`, `survey-manual.txt`가 원본입니다.
이를 수정한 경우 `bun run edge:sync`를 실행합니다. `prebuild`는 자료 동기화를 확인합니다.
테스트는 가짜 AI 응답과 로컬 PostgreSQL(PGlite)을 사용합니다. 실제 AI 정확도나 실제 계정 사용 가능 여부를 검증한 것은 아닙니다.

## 배포 순서

1. 새 Supabase의 현재 테이블·마이그레이션 이력을 먼저 확인합니다. 기존 테이블이 있다면 백업하고 이력을 맞춥니다.
   첫 번째 원본 마이그레이션은 `usage_logs`를 생성하므로, 이력이 없는 기존 테이블에 그대로 실행하면 충돌할 수 있습니다.
2. Supabase CLI에서 `supabase link --project-ref ertujxbknytbyuqgvcuy`로 연결합니다.
3. 대상과 이력을 확인한 뒤 `supabase db push --dry-run`을 검토하고 `supabase db push`를 실행합니다.
   새 마이그레이션은 기존 Drizzle 소유 테이블/열까지 포함합니다. 별도로 Drizzle 마이그레이션을 중복 적용하지 않습니다.
4. Supabase Dashboard → Edge Functions → Secrets에 `supabase/.env.example`의 값을 설정합니다.
   실제 `OPENAI_API_KEY`, `ADMIN_ACCESS_KEY`는 저장소·프런트엔드·채팅에 넣지 않습니다.
   `APP_PUBLISHABLE_KEY`는 새 프로젝트의 공개 키와 같아야 합니다.
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 함수 실행 환경에 제공하는 값을 사용합니다.
5. `supabase functions deploy malhaenong-api --project-ref ertujxbknytbyuqgvcuy`로 배포합니다.
   공개 앱이므로 게이트웨이 JWT 검사는 끄고, 함수 내부에서 공개 프로젝트 키·Origin·요청 한도를 검증합니다.
   관리자 데이터는 별도 관리자 키 검증 후에만 서버 전용 Supabase 키로 읽습니다.
6. 기존 Lovable Database에서 `usage_logs`, `farmer_voices`를 CSV로 내보냅니다.
   먼저 원본 행 수와 내보낸 행 수를 대조합니다. 최종 전환 직전 쓰기를 잠시 중단하거나 최종 차분을 다시 내보내 누락을 방지합니다.
7. 대상 서버 키를 프로세스 환경 변수 `TARGET_SUPABASE_SERVICE_ROLE_KEY`에 안전하게 설정합니다.
   `TARGET_SUPABASE_URL`은 `https://ertujxbknytbyuqgvcuy.supabase.co`로 지정합니다.
   아래 검증을 한 뒤 `--apply`를 추가하면 기존 ID를 보존하고 중복 ID는 건너뜁니다.

```sh
node scripts/import-data.mjs --table usage_logs --file usage_logs.csv
node scripts/import-data.mjs --table farmer_voices --file farmer_voices.csv
```

8. 별도 테스트 빌드에서 `.env.supabase.example`의 프런트엔드 값을 적용합니다.
   `VITE_*` 값은 공개 빌드 설정이며 OpenAI 키나 Supabase 서버 키를 넣으면 안 됩니다.
9. 실제 모델·키·크레딧을 확인한 뒤 `node scripts/evaluate-intent.mjs`로 기본 10개 분류 사례를 검사합니다.
   `TARGET_SUPABASE_URL`, `TARGET_SUPABASE_PUBLISHABLE_KEY`가 필요하고, 실제 AI 사용료가 발생합니다.
   기존 민원 테스트셋 전체와 실제 고령자·방언·잡음 녹음으로 품질을 비교해야 합니다.
10. 실제 질문 답변, 수동 녹음 종료, 담당자 전화 연결, 의견 저장, 관리자 조회, 음성 재생까지 확인합니다.
    Realtime TTS는 텍스트를 읽도록 지시하는 생성 모델이므로 전화번호·숫자·사업명 발음을 꼭 듣고 대조합니다.
11. 검증 후 운영 `.env`에 새 값을 적용하고 프런트엔드를 다시 빌드·게시합니다.
    기존 백엔드와 이전 데이터는 전환 검증이 끝날 때까지 보존합니다.

## GitHub 연동

Supabase Dashboard → Project Settings → Integrations → GitHub에서
`HyejoonJeong/farmland-friend`를 선택하고 프로덕션 브랜치를 `main`으로 지정합니다.
새 프로젝트의 이력과 스키마를 확인하기 전에는 자동 프로덕션 배포를 활성화하지 않습니다.
GitHub의 앱 설치·저장소 권한 승인과 Supabase 프로젝트 연결은 계정 권한이 있는 사용자가 확인해야 합니다.
연결 자체로 기존 Lovable DB의 데이터나 비밀 키가 복사되지는 않습니다.

## 비용과 제한

- 텍스트 기본 Luna, 형식 실패 시에만 Sol 한 번, 출력 토큰 한도를 적용합니다.
- 같은 음성을 다시 듣는 경우 브라우저 메모리의 10분 캐시를 사용합니다(최대 20개/16MB).
- 원시 IP 대신 서버 키로 HMAC한 식별자를 요청 한도에 사용합니다.
- 기본 한도는 IP당 분당 30회, 전체 하루 10,000회입니다. 관리자는 분당 10회입니다.
- 이는 요청 수 제한이며 금액의 상한을 보장하지 않습니다. 실제 예산·키 갱신 정책은 계정에서 따로 설정합니다.
- 30일 만료 API 키를 쓰는 경우 만료 전에 Supabase Secret을 갱신해야 합니다.

## 현재 반영 상태

코드 준비와 로컬 검증용 패키지입니다. GitHub 푸시, Supabase 실제 배포, 데이터 이관,
OpenAI API 키 발급·저장, 실제 AI 품질 테스트, 운영 전환은 계정 연결 후 진행해야 합니다.
기존 Lovable API 라우트와 환경 설정은 롤백을 위해 남겨 두었습니다.
