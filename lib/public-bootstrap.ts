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
local requestSource = nil

local function useRequest(candidate, name)
    if requestFn == nil and type(candidate) == "function" then
        requestFn = candidate
        requestSource = name
    end
end

local function safeIndex(scope, key)
    local ok, value = pcall(function()
        return scope[key]
    end)
    if ok then
        return value
    end
    return nil
end

local function tryScope(scope, name)
    if scope == nil then
        return
    end
    useRequest(safeIndex(scope, "request"), name .. ".request")
    useRequest(safeIndex(scope, "http_request"), name .. ".http_request")
end

tryScope(ENV, "getgenv()")
tryScope(_G, "_G")

local namespaceNames = {
    "syn",
    "http",
    "fluxus",
    "krnl",
    "delta",
    "executor"
}

for _, name in ipairs(namespaceNames) do
    local scope = safeIndex(ENV, name)
    if scope == nil then
        scope = safeIndex(_G, name)
    end
    tryScope(scope, name)
end

if not requestFn then
    error("[Claudmor] executor request API is unavailable after safe probing of getgenv(), _G, syn, http, fluxus, krnl, delta, executor", 0)
end

local compiler = loadstring or load
if type(compiler) ~= "function" then
    error("[Claudmor] loadstring is unavailable", 0)
end

local config = {
    keySystemEnabled = true,
    customUiEnabled = false,
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
                config.customUiEnabled = decoded.customUiEnabled == true
                config.serviceName = tostring(decoded.serviceName or "Claudmor")
            end
        end
    end
end

local uiLibrary = nil

local function getUiLibrary()
    if uiLibrary then
        return uiLibrary
    end

    local uiSource = game:HttpGet("${base}/sdk/library.lua")
    local uiChunk, uiError = compiler(uiSource, "@Claudmor/key-ui")

    if not uiChunk then
        error("[Claudmor] key UI compile failed: " .. tostring(uiError), 0)
    end

    local ui = uiChunk()
    if type(ui) ~= "table" or type(ui.prompt) ~= "function" then
        error("[Claudmor] invalid key UI library", 0)
    end

    uiLibrary = ui
    return uiLibrary
end

local function customKey()
    if not config.customUiEnabled then
        return nil
    end

    local custom = ENV.CLAUDMOR_KEY_UI

    if type(custom) == "function" then
        local ok, value = pcall(custom, {
            serviceId = "${serviceId}",
            serviceName = config.serviceName,
            libraryUrl = "${base}/sdk/library.lua"
        })
        if ok and type(value) == "string" and value ~= "" then
            return value
        end
    elseif type(custom) == "table" and type(custom.prompt) == "function" then
        local ok, value = pcall(custom.prompt, custom, {
            serviceId = "${serviceId}",
            serviceName = config.serviceName
        })
        if ok and type(value) == "string" and value ~= "" then
            return value
        end
    end

    return nil
end

local function promptKey(message, force)
    local value = customKey()
    if type(value) == "string" and value ~= "" then
        return value
    end

    local ui = getUiLibrary()

    if force and type(ui.clearSavedKey) == "function" then
        pcall(ui.clearSavedKey, "${serviceId}")
    end

    local saved = nil
    if not force and type(ui.loadSavedKey) == "function" then
        local ok, result = pcall(ui.loadSavedKey, "${serviceId}")
        if ok and type(result) == "string" and result ~= "" then
            saved = result
        end
    end

    if saved then
        return saved
    end

    return ui.prompt({
        serviceId = "${serviceId}",
        title = config.serviceName,
        description = "Enter your access key to continue.",
        errorText = message,
        force = force == true,
        remember = true
    })
end

local SCRIPT_KEY = type(ENV.SCRIPT_KEY) == "string" and ENV.SCRIPT_KEY or ""

if config.keySystemEnabled and SCRIPT_KEY == "" then
    SCRIPT_KEY = promptKey(nil, false)

    if type(SCRIPT_KEY) ~= "string" or SCRIPT_KEY == "" then
        error("[Claudmor] key entry cancelled", 0)
    end

    ENV.SCRIPT_KEY = SCRIPT_KEY
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

local hwid = getHwid()

local function fetchProtectedLoader()
    return requestFn({
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
            hwid = hwid,
            robloxUserId = tostring(player.UserId),
            robloxUsername = player.Name,
            discordUserId = ENV.DISCORD_USER_ID and tostring(ENV.DISCORD_USER_ID) or nil
        })
    })
end

local source = nil

for attempt = 1, 5 do
    local response = fetchProtectedLoader()
    local status = tonumber(response.StatusCode or response.Status or 0) or 0
    local body = response.Body or response.body or ""

    if status >= 200 and status < 300 then
        source = body

        if config.keySystemEnabled and type(uiLibrary) == "table" and type(uiLibrary.saveKey) == "function" then
            pcall(uiLibrary.saveKey, "${serviceId}", SCRIPT_KEY)
        end

        break
    end

    local keyFailure =
        status == 401 or
        body:find("key_check_failed", 1, true) ~= nil or
        body:find("required_field_check_failed: key", 1, true) ~= nil

    if config.keySystemEnabled and keyFailure and attempt < 5 then
        ENV.SCRIPT_KEY = nil
        SCRIPT_KEY = promptKey(body, true)

        if type(SCRIPT_KEY) ~= "string" or SCRIPT_KEY == "" then
            error("[Claudmor] key entry cancelled", 0)
        end

        ENV.SCRIPT_KEY = SCRIPT_KEY
    else
        error("[Claudmor] loader request failed (" .. tostring(status) .. "): " .. tostring(body), 0)
    end
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
