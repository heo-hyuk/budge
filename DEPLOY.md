# 배포 / Cloudflare 자격증명

이 프로젝트는 Cloudflare 계정 **db848552@gmail.com** (Account ID
`558c8a68615e0f4d92f8d31c8816e799`) 소속입니다.

| 항목 | 값 |
|------|-----|
| 계정 이메일 | db848552@gmail.com |
| Account ID | `558c8a68615e0f4d92f8d31c8816e799` |
| Pages 프로젝트 | `budget` (`budget-3wb.pages.dev`) |
| D1 | `budget-db` (`ff31284d-4e34-4a03-a99c-313cc330d7d0`) |

## 메인 앱 — GitHub Actions 자동배포

`main` 에 push 하면 `.github/workflows/deploy.yml` 이 빌드 후
`wrangler pages deploy dist --project-name=budget` 를 실행한다.
자격증명은 레포 시크릿 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
(GitHub → repo Settings → Secrets and variables → Actions).

로컬에 `wrangler` 로그인이 없어도 메인 앱 배포는 CI 가 처리한다.
수동 배포는 README "배포" 절 참고.

## Cron 워커 (`workers/*`) — 로컬 CLI 배포

`workers/card-settlement-notifier`, `workers/monthly-tax-reporter` 는
별도 Workers 프로젝트라 로컬에서 직접 배포한다. 이때 `wrangler` 가
**db848552** 로 로그인돼 있어야 한다 (계정 2개 — 다른 하나는
`asdf1378kk@gmail.com` = easyprompt / 포트폴리오. 안 맞으면 `code 10000`).

```bash
npx wrangler login        # 브라우저에서 db848552@gmail.com 로 로그인
npx wrangler whoami       # db848552@gmail.com / 558c8a68... 확인
```

- `wrangler login`(브라우저 OAuth)은 네이티브 Windows / macOS 에서 정상.
- **WSL** 은 `localhost:8976` 콜백이 안 잡혀 실패 → API 토큰 사용:
  ```bash
  CLOUDFLARE_API_TOKEN=<db848552 계정 토큰> \
  CLOUDFLARE_ACCOUNT_ID=558c8a68615e0f4d92f8d31c8816e799 \
    npm run deploy
  ```
