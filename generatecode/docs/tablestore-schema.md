# Tablestore Schema

## 1. activation_codes

主键：

- `code` `String`

属性列：

- `duration_days` `Integer`
- `status` `String` (`unused` / `used` / `disabled`)
- `max_bind_count` `Integer`
- `target_user_id` `String`
- `used_by_user_id` `String`
- `used_by_device_id` `String`
- `used_at` `Integer`
- `created_at` `Integer`
- `batch_id` `String`
- `remark` `String`

## 2. user_license

主键：

- `user_id` `String`

属性列：

- `sub_role` `String`
- `device_id` `String`
- `license_status` `String` (`active` / `expired` / `banned`)
- `expire_at` `Integer`
- `remain_days` `Integer`
- `activated_code` `String`
- `updated_at` `Integer`

## 3. activation_logs

主键：

- `log_id` `String`

属性列：

- `user_id` `String`
- `device_id` `String`
- `code` `String`
- `action` `String`
- `result` `String`
- `message` `String`
- `time` `Integer`

## 4. system_meta

主键：

- `meta_key` `String`

属性列：

- `current_value` `Integer`
- `updated_at` `Integer`

说明：

- 用于存内部用户 ID 的序列游标
- 例如：`meta_key = user_id_sequence`
- `current_value = 10` 表示当前已经分配到 `U000010`

## 用户 ID 生成规则

- 第一次生成 10 个激活码：分配 `U000001` 到 `U000010`
- 第二次生成 5 个激活码：分配 `U000011` 到 `U000015`
- 不要每次扫描激活码表找最大用户 ID，应维护单独序列表
