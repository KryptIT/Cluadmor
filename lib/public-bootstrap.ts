export function buildPublicBootstrap(baseUrl: string, serviceId: string) {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  return `local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RbxAnalyticsService = game:GetService("RbxAnalyticsService")

local ENV = _G
if type(getgenv) == "function" then
    local okEnv, resolvedEnv = pcall(getgenv)
    if okEnv and type(resolvedEnv) == "table" then
        ENV = resolvedEnv
    end
end

local requestFn = nil
if type(request) == "function" then
    requestFn = request
elseif type(http_request) == "function" then
    requestFn = http_request
elseif type(syn) == "table" and type(syn.request) == "function" then
    requestFn = syn.request
elseif type(http) == "table" and type(http.request) == "function" then
    requestFn = http.request
end

if not requestFn then
    error("[Claudmor] executor request API is unavailable", 0)
end

local compiler = loadstring or load
if type(compiler) ~= "function" then
    error("[Claudmor] loadstring is unavailable", 0)
end

local config = {
    keySystemEnabled = true,
    keyUiMode = "DEFAULT",
    serviceName = "Claudmor"
}

do
    local okConfig, result = pcall(function()
        return requestFn({
            Url = "${base}/api/v1/key-ui/config?serviceId=${serviceId}",
            Method = "GET",
            Headers = {
                ["Accept"] = "application/json",
                ["X-Claudmor-Client"] = "executor"
            }
        })
    end)

    if okConfig and type(result) == "table" then
        local status = tonumber(result.StatusCode or result.Status or 0) or 0
        local raw = result.Body or result.body or ""

        if status >= 200 and status < 300 and type(raw) == "string" then
            local okJson, decoded = pcall(HttpService.JSONDecode, HttpService, raw)
            if okJson and type(decoded) == "table" then
                config.keySystemEnabled = decoded.keySystemEnabled ~= false
                config.keyUiMode = tostring(decoded.keyUiMode or "DEFAULT")
                config.serviceName = tostring(decoded.serviceName or "Claudmor")
            end
        end
    end
end

local SCRIPT_KEY = type(ENV.SCRIPT_KEY) == "string" and ENV.SCRIPT_KEY or ""

if config.keySystemEnabled and SCRIPT_KEY == "" then
    if config.keyUiMode == "DEFAULT" then
        local uiSource = game:HttpGet("${base}/ui/keysystem.lua")
        local uiChunk, uiError = compiler(uiSource, "@Claudmor/key-ui")
        if not uiChunk then
            error("[Claudmor] key UI compile failed: " .. tostring(uiError), 0)
        end

        local ui = uiChunk()
        if type(ui) ~= "table" or type(ui.prompt) ~= "function" then
            error("[Claudmor] invalid key UI library", 0)
        end

        SCRIPT_KEY = ui.prompt({
            title = config.serviceName,
            description = "Enter your access key to continue."
        })

        if type(SCRIPT_KEY) ~= "string" or SCRIPT_KEY == "" then
            error("[Claudmor] key entry cancelled", 0)
        end

        ENV.SCRIPT_KEY = SCRIPT_KEY
    else
        error("[Claudmor] custom key UI must set getgenv().SCRIPT_KEY before running the loader", 0)
    end
end

local function getHwid()
    if type(ENV.CLAUDMOR_HWID) == "string" and ENV.CLAUDMOR_HWID ~= "" then
        return ENV.CLAUDMOR_HWID
    end

    local probes = {
        ENV.gethwid,
        ENV.get_hwid,
        rawget(_G, "gethwid"),
        rawget(_G, "get_hwid")
    }

    for _, probe in ipairs(probes) do
        if type(probe) == "function" then
            local ok, value = pcall(probe)
            if ok and type(value) == "string" and value ~= "" then
                return value
            end
        end
    end

    local ok, value = pcall(function()
        return RbxAnalyticsService:GetClientId()
    end)

    if ok and type(value) == "string" and value ~= "" then
        return value
    end

    error("[Claudmor] unable to resolve HWID", 0)
end

local player = Players.LocalPlayer
while not player do
    Players:GetPropertyChangedSignal("LocalPlayer"):Wait()
    player = Players.LocalPlayer
end

local response = requestFn({
    Url = "${base}/api/v1/loader/runtime",
    Method = "POST",
    Headers = {
        ["Content-Type"] = "application/json",
        ["Accept"] = "text/plain",
        ["X-Claudmor-Client"] = "executor",
        ["X-Claudmor-Protocol"] = "1"
    },
    Body = HttpService:JSONEncode({
        serviceId = "${serviceId}",
        key = SCRIPT_KEY,
        hwid = getHwid(),
        robloxUserId = tostring(player.UserId),
        robloxUsername = player.Name,
        discordUserId = ENV.DISCORD_USER_ID and tostring(ENV.DISCORD_USER_ID) or nil
    })
})

local status = tonumber(response.StatusCode or response.Status or 0) or 0
local source = response.Body or response.body or ""

if status < 200 or status >= 300 then
    error("[Claudmor] loader request failed (" .. tostring(status) .. "): " .. tostring(source), 0)
end

if type(source) ~= "string" or source == "" then
    error("[Claudmor] loader response is empty", 0)
end

local chunk, compileError = compiler(source, "@Claudmor/loader")
if not chunk then
    error("[Claudmor] loader compile failed: " .. tostring(compileError), 0)
end

return chunk()
`;
}
