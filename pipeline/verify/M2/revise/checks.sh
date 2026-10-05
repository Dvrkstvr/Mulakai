W=/e/repos/Mulakai/.claude/worktrees/agent-a15895f05108fb2b4
R=/e/repos/Mulakai/pipeline/verify/M2/revise/raw
export TEMP='E:\ai\tmp\m2r' TMP='E:\ai\tmp\m2r'; mkdir -p /e/ai/tmp/m2r
cd $W/server && npx tsc --noEmit > $R/check-server-tsc.log 2>&1; echo "server tsc exit $?" >> $R/checks.summary
cd $W/server && npm test > $R/check-server-test.log 2>&1; echo "server test exit $?" >> $R/checks.summary
cd $W/client && npm run build > $R/check-client-build.log 2>&1; echo "client build exit $?" >> $R/checks.summary
cd $W/client && npm run lint > $R/check-client-lint.log 2>&1; echo "client lint exit $?" >> $R/checks.summary
cd $W/client && npm test > $R/check-client-test.log 2>&1; echo "client test exit $?" >> $R/checks.summary
cd $W/e2e && npx playwright test score > $R/check-e2e.log 2>&1; echo "e2e score exit $?" >> $R/checks.summary
echo done >> $R/checks.summary
