-- 添加nameCustomized字段来标记节点名称是否被用户自定义
-- 默认为false，表示使用Agent提供的默认名称
-- 当用户手动修改节点名称时，设置为true
ALTER TABLE "nodes" ADD COLUMN "nameCustomized" BOOLEAN NOT NULL DEFAULT false;

-- 为已存在的节点，保护所有非默认格式的名称不被Agent覆盖
-- 以下情况将被标记为用户自定义：
-- 1. 不符合默认格式 Node-XXXXXXXX 的名称
-- 2. 包含中文、特殊符号或有意义单词的名称
-- 3. 任何看起来像是人工命名的节点
UPDATE "nodes" 
SET "nameCustomized" = true 
WHERE "name" !~ '^Node-[a-zA-Z0-9]{8}$'
   OR "name" ~ '[\u4e00-\u9fff]'  -- 包含中文字符
   OR "name" ~ '[^a-zA-Z0-9\-_\.]'  -- 包含特殊字符（除了常见分隔符）
   OR length("name") > 20  -- 名称过长，可能是自定义的
   OR "name" ~* '(server|node|vps|host|machine|agent|monitor|test|prod|dev|asia|europe|america|tokyo|london|sydney|singapore|hongkong|beijing|shanghai|guangzhou|shenzhen|mumbai|delhi|seoul|osaka|taiwan|macau)'  -- 包含地名或服务器相关词汇
;