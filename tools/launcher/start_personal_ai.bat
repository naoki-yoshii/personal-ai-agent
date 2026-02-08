@echo off
setlocal
set ROOT=C:\AI\personal-ai-agent

REM 3つを別ウィンドウで起動（落ちないように /k）
start "mcp-notion-rag"  cmd /k "cd /d %ROOT%\mcp-notion-rag  && npm run dev"
start "mcp-web-search"  cmd /k "cd /d %ROOT%\mcp-web-search  && npm run dev"
start "agent-server"    cmd /k "cd /d %ROOT%\agent-server    && npm run dev"

REM 少し待ってからブラウザを開く
timeout /t 2 >nul
start "" "http://localhost:3100/"
endlocal
