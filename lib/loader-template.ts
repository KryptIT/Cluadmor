export function buildLoader(baseUrl: string, serviceId: string) {
  const base = baseUrl.replace(/\/+$/, "");

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

-- Captured before any network wait so a later swap of loadstring is not picked up.
local compiler = loadstring or load
if type(compiler) ~= "function" then
    error("[Claudmor] loadstring is unavailable", 0)
end

local function post(path, body, headers)
    local h = {
        ["Content-Type"] = "application/json",
        ["Accept"] = "application/json"
    }

    if headers then
        for k, v in pairs(headers) do
            h[k] = v
        end
    end

    local response = requestFn({
        Url = "${base}" .. path,
        Method = "POST",
        Headers = h,
        Body = HttpService:JSONEncode(body or {})
    })

    local status = tonumber(response.StatusCode or response.Status or 0) or 0
    local raw = response.Body or response.body or ""

    if status < 200 or status >= 300 then
        local detail = raw
        pcall(function()
            local decoded = HttpService:JSONDecode(raw)
            detail = decoded.detail or decoded.error or raw
        end)
        error("[Claudmor] request failed (" .. tostring(status) .. "): " .. tostring(detail), 0)
    end

    local ok, decoded = pcall(HttpService.JSONDecode, HttpService, raw)
    if not ok or type(decoded) ~= "table" then
        error("[Claudmor] invalid server response", 0)
    end

    return decoded
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

-- Fresh random nonce per run; the server binds this run's session and ticket to it,
-- so a captured request sequence cannot be replayed without it.
local function makeNonce()
    local rng = Random.new(tick() + os.clock() * 1e6)
    local parts = {
        (HttpService:GenerateGUID(false):gsub("-", ""))
    }

    local seeds = {
        os.time(),
        math.floor(tick() * 1000) % 0x7fffffff,
        math.floor(os.clock() * 1e6) % 0x7fffffff
    }
    for _, seed in ipairs(seeds) do
        table.insert(parts, string.format("%08x", seed))
    end

    for _ = 1, 4 do
        table.insert(parts, string.format("%08x", rng:NextInteger(0, 0x7fffffff)))
    end

    return table.concat(parts)
end

local nonce = makeNonce()

local auth = post("/api/v1/auth", {
    serviceId = "${serviceId}",
    key = SCRIPT_KEY,
    hwid = hwid,
    nonce = nonce,
    robloxUserId = tostring(player.UserId),
    robloxUsername = player.Name,
    discordUserId = ENV.DISCORD_USER_ID and tostring(ENV.DISCORD_USER_ID) or nil
})

if type(auth.session) ~= "string" then
    error("[Claudmor] auth session missing", 0)
end

local ticket = post("/api/v1/bootstrap/ticket", {}, {
    ["Authorization"] = "Bearer " .. auth.session
})

if type(ticket.ticket) ~= "string" then
    error("[Claudmor] bootstrap ticket missing", 0)
end

local delivery = post("/api/v1/loader/fetch", {
    ticket = ticket.ticket,
    hwid = hwid,
    nonce = nonce,
    placeId = tostring(game.PlaceId),
    universeId = tostring(game.GameId)
})

if type(delivery.source) ~= "string" or delivery.source == "" then
    error("[Claudmor] routed script is empty", 0)
end

-- The server names a one-off random slot for the delivery token; fall back to the fixed names.
local guardSlot = type(delivery.guardSlot) == "string" and delivery.guardSlot or nil

local function setMarkers(on)
    if guardSlot then
        ENV[guardSlot] = on and delivery.deliveryToken or nil
    else
        ENV.__CLAUDMOR_DELIVERY = on and delivery.deliveryToken or nil
    end
    -- Scripts built by the obfuscate route carry their own guard that checks these two.
    ENV.__CLAUDMOR_AUTHORIZED = on or nil
    ENV.__CLAUDMOR_SERVICE = on and "${serviceId}" or nil
end

local chunk, compileError = compiler(delivery.source, "@Claudmor/" .. tostring(delivery.scriptName or "script"))
if not chunk then
    error("[Claudmor] compile failed: " .. tostring(compileError), 0)
end

-- Keeps the runtime session alive with a rotating token; when the server ends the session
-- (revoked key, expired, replayed token) the markers are cleared. Best effort: code that is
-- already running cannot be forcibly stopped, but the session is dead server-side.
local heartbeat = delivery.heartbeat
if type(heartbeat) == "table" and type(heartbeat.token) == "string" and type(heartbeat.endpoint) == "string" then
    local beatToken = heartbeat.token
    local interval = tonumber(heartbeat.interval) or 45

    task.spawn(function()
        while true do
            task.wait(interval)
            local okBeat, beat = pcall(post, heartbeat.endpoint, {
                token = beatToken,
                hwid = hwid,
                nonce = nonce
            })

            if not okBeat or type(beat) ~= "table" or beat.ok ~= true or type(beat.token) ~= "string" then
                setMarkers(false)
                ENV.__CLAUDMOR_SESSION_ENDED = true
                break
            end

            beatToken = beat.token
            interval = tonumber(beat.interval) or interval
        end
    end)
end

setMarkers(true)
local ok, result = pcall(chunk)
setMarkers(false)

if not ok then
    error(result, 0)
end

return result
`;
}
