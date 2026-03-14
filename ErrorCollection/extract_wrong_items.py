import json
import os
from dashscope import Generation

# ── 初始化客户端 ──────────────────────────────────────────
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "sk-c5428363330046f59b20deb70210eb9a")
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen-plus")

# ── 知识点标签库（精简版，测试用）────────────────────────
KNOWLEDGE_TAG_LIBRARY = """
数学标签库：
- 数与运算 > 整数四则运算
- 数与运算 > 小数四则运算
- 数与运算 > 分数四则运算
- 数与运算 > 百分数
- 数与运算 > 数的整除性
- 空间与图形 > 平面图形面积
- 空间与图形 > 平面图形周长
- 空间与图形 > 单位换算
- 应用题专项 > 行程问题
- 应用题专项 > 工程问题
- 应用题专项 > 归一归总
- 审题能力 > 关键词识别
- 审题能力 > 条件整理
"""

# ── 提取Prompt ────────────────────────────────────────────
EXTRACT_PROMPT = """
你是中国小学教育专家，从学生学习对话中提取错题信息并完成诊断。

## 当前模式
{mode}

## 已知信息（订正模式直接传入，伴学模式从对话提取）
题目原文：{question_text}
孩子错误答案：{student_answer}

## 本道题的完整对话片段
{conversation_segment}

## 该学生历史数据
是否已有该题活跃记录：{has_existing}
已有记录的当前状态：{existing_record}
该学科知识点历史情况：{tag_history}

---

## 第一步：确认题目信息
订正模式直接使用已知信息；伴学模式从对话中还原。

## 第二步：判断第二层知识点标签
对照下方标签库，判断这道题考查的是哪个知识点。
匹配不到时，输出格式：[待确认]你的命名

知识点标签库：
{knowledge_tags}

## 第三步：判断第一层错误类型

四种类型定义：

没搞懂：对知识点本身的理解是错的
  识别信号：多次引导后仍有相同逻辑错误；能背规则但用错场景；历史同知识点反复出错；对话中出现说懂了但换题又错

还不熟：理解对，方法还没自动化
  识别信号：给1次提示就做对；首次出现该知识点错误；当次能解决但历史有过同类错误

不会变通：原题型会做，换形式就失败
  识别信号：历史标准题正确，本次换了情境或形式出错；AI提示「和之前类似」后才做对

没注意：完全掌握，偶发疏漏
  识别信号：AI稍提醒立刻自我纠正并说「我知道」；换同类题马上对；历史该知识点从未出过类似问题

判断优先级：
引导次数 >= 3 且错误逻辑一致       → 没搞懂
对话中出现假性理解                 → 没搞懂 或 不会变通
has_existing=true 且历史多次重置   → 没搞懂
引导1-2次且历史首次出现            → 还不熟
历史标准题正确，本次换题型出错      → 不会变通
引导1次且孩子有自我纠正表述        → 没注意

## 第四步：写第三层AI描述
用小学生能看懂的话，说清楚：错了什么 + 错误的具体表现。
不超过50字。不出现「你」。

---

## 输出格式
只输出JSON，不输出任何其他文字。

{{
  "question_text": "题目完整原文",
  "question_type": "计算题 | 应用题 | 填空题 | 判断题 | 主观题",
  "student_answer": "孩子的错误答案",
  "subject": "数学 | 语文 | 英语",
  "layer1_error_type": "没搞懂 | 还不熟 | 不会变通 | 没注意",
  "layer1_confidence": "high | medium | low",
  "layer2_level1": "一级分类",
  "layer2_level2": "二级知识点",
  "layer2_is_new_tag": false,
  "layer3_description": "错了什么+具体表现，不超过50字",
  "guidance_count": 0
}}
"""

# ── 核心函数：切割单道题的对话片段 ───────────────────────
def extract_question_segment(messages, question_index, ocr_results):
    """
    从完整对话中切割出某道题的对话片段。
    订正模式：从上一道题的 mastery_confirmed=true 之后，
              到本道题的 mastery_confirmed=true 为止。
    """
    # 找到所有 mastery_confirmed=true 的位置
    confirmed_positions = []
    for i, msg in enumerate(messages):
        if msg["role"] == "assistant":
            meta = msg.get("meta_data", {})
            if meta.get("mastery_confirmed") == True:
                confirmed_positions.append(i)

    # 确定本道题对话的起止范围
    if question_index == 0:
        start = 0
    else:
        start = confirmed_positions[question_index - 1] + 1

    if question_index < len(confirmed_positions):
        end = confirmed_positions[question_index] + 1
    else:
        end = len(messages)

    segment = messages[start:end]

    # 转成可读文本
    lines = []
    for msg in segment:
        role_label = "AI老师" if msg["role"] == "assistant" else (
            "学生" if msg["role"] == "user" else "系统"
        )
        if msg["role"] in ["assistant", "user"]:
            content = msg["content"]
            # assistant消息去掉meta_data，只保留对话内容
            lines.append(f"{role_label}：{content}")

    return "\n".join(lines)


# ── 核心函数：调用API提取单道题的错题信息 ────────────────
def extract_single_question(
    mode,
    question_text,
    student_answer,
    conversation_segment,
    has_existing=False,
    existing_record=None,
    tag_history=None
):
    prompt = EXTRACT_PROMPT.format(
        mode=mode,
        question_text=question_text,
        student_answer=student_answer,
        conversation_segment=conversation_segment,
        has_existing=str(has_existing),
        existing_record=json.dumps(existing_record, ensure_ascii=False) if existing_record else "无",
        tag_history=json.dumps(tag_history, ensure_ascii=False) if tag_history else "无历史记录",
        knowledge_tags=KNOWLEDGE_TAG_LIBRARY
    )

    response = Generation.call(
        api_key=DASHSCOPE_API_KEY,
        model=QWEN_MODEL,
        messages=[{"role": "user", "content": prompt}],
        result_format="message",
        temperature=0,
    )

    if response.status_code != 200:
        raise RuntimeError(
            f"千问 API 请求失败: HTTP {response.status_code} - "
            f"{response.code}: {response.message}"
        )

    raw_output = response.output.choices[0].message.content.strip()

    # 清理可能的代码块标记
    if raw_output.startswith("```"):
        raw_output = raw_output.split("```")[1]
        if raw_output.startswith("json"):
            raw_output = raw_output[4:]
    raw_output = raw_output.strip()

    result = json.loads(raw_output)
    return result


# ── 主流程 ────────────────────────────────────────────────
def process_conversation(file_path):
    print(f"\n{'='*60}")
    print(f"开始处理对话文件：{file_path}")
    print(f"{'='*60}\n")

    with open(file_path, "r", encoding="utf-8") as f:
        conversation = json.load(f)

    mode = conversation["mode"]
    messages = conversation["messages"]
    ocr_results = conversation.get("ocr_results", [])
    subject = conversation["subject"]
    grade = conversation["grade"]
    student_name = conversation["student_name"]

    print(f"学生：{student_name} | 年级：{grade}年级 | 科目：{subject} | 模式：{mode}模式")
    print(f"OCR识别到 {len(ocr_results)} 道错题\n")

    all_results = []

    for i, ocr_item in enumerate(ocr_results):
        print(f"--- 正在处理第 {i+1} 道题 ---")
        print(f"题目：{ocr_item['question_text']}")
        print(f"孩子的答案：{ocr_item['student_answer']}")

        # 切割这道题的对话片段
        segment = extract_question_segment(messages, i, ocr_results)
        print(f"\n对话片段（共{len(segment.splitlines())}行）：")
        print(segment)

        # 调用API提取
        print("\n正在调用AI提取错题信息...")
        result = extract_single_question(
            mode=mode + "模式",
            question_text=ocr_item["question_text"],
            student_answer=ocr_item["student_answer"],
            conversation_segment=segment,
            has_existing=False,       # 本地测试暂时写死，正式版从DB查询
            existing_record=None,
            tag_history=None
        )

        # 补充系统字段（正式版写入DB时用）
        result["wrong_item_id"] = f"wi_{conversation['conversation_id']}_{i+1:03d}"
        result["student_id"] = conversation["student_id"]
        result["grade"] = grade
        result["first_conversation_id"] = conversation["conversation_id"]
        result["is_variant"] = False
        result["source_item_id"] = None
        result["variant_generation"] = 0
        result["variant_note"] = None
        result["status"] = "active"
        result["push_strategy"] = {
            "没搞懂": "intensive",
            "还不熟": "standard",
            "不会变通": "flexible",
            "没注意": "minimal"
        }.get(result["layer1_error_type"], "standard")
        result["occurrence_count"] = 1

        all_results.append(result)

        print("\n提取结果：")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print()

    # 保存结果
    output_path = file_path.replace(".json", "_extracted.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"提取完成！共处理 {len(all_results)} 道题")
    print(f"结果已保存至：{output_path}")
    print(f"{'='*60}\n")

    return all_results


# ── 入口 ──────────────────────────────────────────────────
if __name__ == "__main__":
    results = process_conversation("conversation_sample.json")
