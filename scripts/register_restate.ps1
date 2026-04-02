# Register the local Next.js environment endpoint manually inside the Docker Restate Admin server.
# Note: Windows Docker Desktop resolves `host.docker.internal` back to the Windows host seamlessly.

$headers = @{ "Content-Type" = "application/json" }
$body = '{"uri": "http://172.22.0.5:3000/api/restate"}'

Invoke-RestMethod -Uri "http://localhost:9070/deployments" -Method Post -Headers $headers -Body $body

Write-Host "Restate Server Registered NextJS Webhooks Successfully." -ForegroundColor Green
