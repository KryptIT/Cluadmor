export function buildPublicBootstrap(baseUrl: string, serviceId: string) {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  return `local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RbxAnalyticsService = game:GetService("RbxAnalyticsService")

local GLOBAL_ENV = type(_G) == "table" and _G or {}
local ENV = GLOBAL_ENV
if type(getgenv) == "function" then
    local okEnv, resolvedEnv = pcall(getgenv)
    if okEnv and type(resolvedEnv) == "table" then
        ENV = resolvedEnv
    end
end

local requestFn = type(request) == "function" and request or nil
if type(requestFn) ~= "function" and type(http_request) == "function" then
    requestFn = http_request
end

local function httpGet(url)
    if requestFn then
        local response = requestFn({
            Url = url,
            Method = "GET"
        })

        local status = tonumber(response.StatusCode or response.Status or 0) or 0
        local body = response.Body or response.body or ""

        if status >= 200 and status < 300 then
            return body
        end

        error("[Claudmor] GET failed (" .. tostring(status) .. ")", 0)
    end

    local ok, body = pcall(function()
        return game:HttpGet(url)
    end)
    if ok and type(body) == "string" then
        return body
    end

    ok, body = pcall(function()
        return game:HttpGetAsync(url)
    end)
    if ok and type(body) == "string" then
        return body
    end

    error("[Claudmor] no HTTP GET transport; expected request(), game:HttpGet(), or game:HttpGetAsync()", 0)
end

local function httpPost(url, bodyTable, headers)
    local encoded = HttpService:JSONEncode(bodyTable or {})

    if requestFn then
        local response = requestFn({
            Url = url,
            Method = "POST",
            Headers = headers or {
                ["Content-Type"] = "application/json"
            },
            Body = encoded
        })

        return response.Body or response.body or ""
    end

    local ok, body = pcall(function()
        return game:HttpPost(url, encoded, Enum.HttpContentType.ApplicationJson)
    end)

    if not ok then
        ok, body = pcall(function()
            return game:HttpPost(url, encoded)
        end)
    end

    if not ok then
        error("[Claudmor] no HTTP POST transport; expected request() or game:HttpPost(): " .. tostring(body), 0)
    end

    return type(body) == "string" and body or tostring(body or "")
end

local compiler = nil
if type(ENV.loadstring) == "function" then
    compiler = ENV.loadstring
elseif type(loadstring) == "function" then
    compiler = loadstring
elseif type(ENV.load) == "function" then
    compiler = ENV.load
elseif type(load) == "function" then
    compiler = load
end

if type(compiler) ~= "function" then
    error("[Claudmor] loadstring is unavailable", 0)
end

local config = {
    keySystemEnabled = true,
    customUiEnabled = false,
    serviceName = "Claudmor",
    getKeyUrl = "",
    getKeyProvider = nil
}

do
    local okConfig, raw = pcall(httpGet, "${base}/api/v1/key-ui/config?serviceId=${serviceId}")

    if okConfig and type(raw) == "string" then
        local okJson, decoded = pcall(HttpService.JSONDecode, HttpService, raw)
        if okJson and type(decoded) == "table" then
            config.keySystemEnabled = decoded.keySystemEnabled ~= false
            config.customUiEnabled = decoded.customUiEnabled == true
            config.serviceName = tostring(decoded.serviceName or "Claudmor")
            config.getKeyUrl = type(decoded.getKeyUrl) == "string" and decoded.getKeyUrl or ""
            config.getKeyProvider = type(decoded.getKeyProvider) == "string" and decoded.getKeyProvider or nil
        end
    end
end

local uiLibrary = nil

local function getUiLibrary()
    if uiLibrary then
        return uiLibrary
    end

    local uiSource = httpGet("${base}/sdk/library.lua")
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

local function promptKey(message, force, existingKey)
    local value = customKey()
    if type(value) == "string" and value ~= "" then
        return value
    end

    local ui = getUiLibrary()

    if force and type(ui.clearSavedKey) == "function" then
        pcall(ui.clearSavedKey, "${serviceId}")
    end

    local saved = nil
    if type(existingKey) == "string" and existingKey ~= "" then
        saved = existingKey
    elseif not force and type(ui.loadSavedKey) == "function" then
        local ok, result = pcall(ui.loadSavedKey, "${serviceId}")
        if ok and type(result) == "string" and result ~= "" then
            saved = result
        end
    end

    return ui.prompt({
        serviceId = "${serviceId}",
        title = config.serviceName,
        description = "Enter your access key to continue.",
        errorText = message,
        force = force == true,
        remember = true,
        initialValue = saved,
        getKeyUrl = config.getKeyUrl,
        getKeyProvider = config.getKeyProvider
    })
end

local SCRIPT_KEY = type(ENV.SCRIPT_KEY) == "string" and ENV.SCRIPT_KEY or ""

if config.keySystemEnabled then
    SCRIPT_KEY = promptKey(nil, false, SCRIPT_KEY)

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
        gethwid,
        get_hwid
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
    local raw = httpPost(
        "${base}/api/v1/loader/runtime?transport=bootstrap",
        {
            serviceId = "${serviceId}",
            key = SCRIPT_KEY,
            hwid = hwid,
            robloxUserId = tostring(player.UserId),
            robloxUsername = player.Name,
            discordUserId = ENV.DISCORD_USER_ID and tostring(ENV.DISCORD_USER_ID) or nil
        },
        {
            ["Content-Type"] = "application/json",
            ["Accept"] = "application/json",
            ["X-Claudmor-Client"] = "executor",
            ["X-Claudmor-Protocol"] = "1"
        }
    )

    local okJson, decoded = pcall(HttpService.JSONDecode, HttpService, raw)
    if not okJson or type(decoded) ~= "table" then
        error("[Claudmor] invalid loader transport response", 0)
    end

    return decoded
end

local source = nil

for attempt = 1, 5 do
    local response = fetchProtectedLoader()

    if response.ok == true and type(response.source) == "string" then
        source = response.source

        if config.keySystemEnabled and type(uiLibrary) == "table" and type(uiLibrary.saveKey) == "function" then
            pcall(uiLibrary.saveKey, "${serviceId}", SCRIPT_KEY)
        end

        break
    end

    local status = tonumber(response.status or 0) or 0
    local body = tostring(response.error or response.detail or "loader request failed")
    local keyFailure =
        status == 401 or
        body:find("key_check_failed", 1, true) ~= nil or
        body:find("required_field_check_failed: key", 1, true) ~= nil

    if config.keySystemEnabled and keyFailure and attempt < 5 then
        ENV.SCRIPT_KEY = nil
        SCRIPT_KEY = promptKey(body, true, nil)

        if type(SCRIPT_KEY) ~= "string" or SCRIPT_KEY == "" then
            error("[Claudmor] key entry cancelled", 0)
        end

        ENV.SCRIPT_KEY = SCRIPT_KEY
    else
        error("[Claudmor] loader request failed (" .. tostring(status) .. "): " .. body, 0)
    end
end

if type(source) ~= "string" or source == "" then
    error("[Claudmor] loader response is empty", 0)
end

local chunk, compileError = compiler(source, "@Claudmor/loader")
if not chunk then
    error("[Claudmor] loader compile failed: " .. tostring(compileError), 0)
end

return chunk(compiler)
`;
}
