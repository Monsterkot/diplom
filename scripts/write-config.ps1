$json = @'
{
  "security": {
    "auth": {
      "selectedType": "qwen-oauth"
    }
  },
  "model": {
    "name": "coder-model"
  },
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp", "--api-key", "ctx7sk-ddd64d83-161d-4908-b710-ab4db583dea7"]
    }
  },
  "$version": 3
}
'@

[System.IO.File]::WriteAllText("$env:USERPROFILE\.qwen\settings.json", $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Config written successfully"
