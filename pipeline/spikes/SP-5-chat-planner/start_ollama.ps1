$env:OLLAMA_HOST = "127.0.0.1:11435"
$env:OLLAMA_CONTEXT_LENGTH = "16384"
$env:OLLAMA_MODELS = "E:\ai\ollama\models"
$env:OLLAMA_KEEP_ALIVE = "5m"
$p = Start-Process -FilePath "ollama" -ArgumentList "serve" -PassThru -WindowStyle Hidden -RedirectStandardOutput "E:\ai\tmp\sp5\ollama.out.log" -RedirectStandardError "E:\ai\tmp\sp5\ollama.err.log"
$p.Id | Out-File E:\ai\tmp\sp5\ollama_pid.txt
"started $($p.Id)"
