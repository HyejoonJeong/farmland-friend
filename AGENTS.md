<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- 농지은행 담당자 연결은 최신 업무 분류표의 업무별·지역별 직통번호 행렬을 직접 조회한다 — 업무명 유사도 추측은 잘못된 담당자 연결을 만들 수 있다.
- Intent classification is two-stage: /api/intent returns category, candidates and HIGH/MEDIUM/LOW; non-HIGH goes to button-based cases in src/lib/clarify-flow.ts (max 2 questions, then general_consult → 1577-7770). Why: avoid guessing between similar farmland-bank businesses.
