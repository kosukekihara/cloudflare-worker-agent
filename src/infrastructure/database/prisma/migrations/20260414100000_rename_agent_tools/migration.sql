-- ツール名リネーム: 旧キー名を新キー名に統一する
-- postalCodeLookup → lookupAddress
-- weather → getWeather
-- getUsers → listUsers
UPDATE "agents" SET "enabled_tools" = array_replace("enabled_tools", 'postalCodeLookup', 'lookupAddress');
UPDATE "agents" SET "enabled_tools" = array_replace("enabled_tools", 'weather', 'getWeather');
UPDATE "agents" SET "enabled_tools" = array_replace("enabled_tools", 'getUsers', 'listUsers');
