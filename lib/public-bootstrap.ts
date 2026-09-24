export function buildPublicBootstrap(baseUrl: string, serviceId: string) {
  const base = baseUrl.replace(/\\\/+$/, "");

  return \`local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RbxAnalyticsService = game:GetService("RbxAnalyticsService")

local ENV = (getgenv and getgenv()) or _G
local SCRIPT_KEY = ENV.SCRIPT_KEY

if type(SCRIPT_KEY) ~= "string" or SCRIPT_KEY == "" then
    error("[Claudmor] getgenv().SCRIPT_KEY is missing", 0)
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
    Url = "\${base}/api/v1/loader/runtime",
    Method = "POST",
    Headers = {
        ["Content-Type"] = "application/json",
        ["Accept"] = "text/plain",
        ["X-Claudmor-Client"] = "executor",
        ["X-Claudmor-Protocol"] = "1"
    },
    Body = HttpService:JSONEncode({
        serviceId = "\${serviceId}",
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

local compiler = loadstring or load
if type(compiler) ~= "function" then
    error("[Claudmor] loadstring is unavailable", 0)
end

local chunk, compileError = compiler(source, "@Claudmor/loader")
if not chunk then
    error("[Claudmor] loader compile failed: " .. tostring(compileError), 0)
end

return chunk()
\`;
}
