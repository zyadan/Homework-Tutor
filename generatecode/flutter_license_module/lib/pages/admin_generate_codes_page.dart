import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/generated_code_batch.dart';
import '../services/license_admin_api.dart';

class AdminGenerateCodesPage extends StatefulWidget {
  const AdminGenerateCodesPage({
    super.key,
    required this.api,
  });

  final LicenseAdminApi api;

  @override
  State<AdminGenerateCodesPage> createState() => _AdminGenerateCodesPageState();
}

class _AdminGenerateCodesPageState extends State<AdminGenerateCodesPage>
    with AutomaticKeepAliveClientMixin {
  final _formKey = GlobalKey<FormState>();
  final _countController = TextEditingController(text: '10');
  final _durationController = TextEditingController(text: '30');
  final _prefixController = TextEditingController(text: 'VIP');
  final _batchIdController = TextEditingController(text: 'LOCAL_BATCH_001');
  final _remarkController = TextEditingController();

  GeneratedCodeBatch? _result;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _countController.dispose();
    _durationController.dispose();
    _prefixController.dispose();
    _batchIdController.dispose();
    _remarkController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final result = await widget.api.generateCodes(
        count: int.parse(_countController.text.trim()),
        durationDays: int.parse(_durationController.text.trim()),
        prefix: _prefixController.text.trim(),
        batchId: _batchIdController.text.trim().isEmpty
            ? null
            : _batchIdController.text.trim(),
        remark: _remarkController.text.trim().isEmpty
            ? null
            : _remarkController.text.trim(),
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _result = result;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _copyAllItems() async {
    final result = _result;
    if (result == null || result.items.isEmpty) {
      return;
    }
    final text = result.items.map((item) => item.code).join('\n');
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('激活码已复制')),
    );
  }

  Future<void> _copyItem(GeneratedLicenseItem item) async {
    await Clipboard.setData(ClipboardData(text: item.code));
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已复制: ${item.code}')),
    );
  }

  String? _requiredNumber(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return '必填';
    }
    final number = int.tryParse(text);
    if (number == null || number <= 0) {
      return '请输入大于 0 的数字';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '生成激活码',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    const Text('每生成一个激活码，后端会自动分配一个连续用户ID并写入数据库。'),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _countController,
                      decoration: const InputDecoration(
                        labelText: '生成数量',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.number,
                      validator: _requiredNumber,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _durationController,
                      decoration: const InputDecoration(
                        labelText: '授权天数',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.number,
                      validator: _requiredNumber,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _prefixController,
                      decoration: const InputDecoration(
                        labelText: '前缀',
                        border: OutlineInputBorder(),
                      ),
                      validator: (value) =>
                          (value == null || value.trim().isEmpty) ? '必填' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _batchIdController,
                      decoration: const InputDecoration(
                        labelText: '批次号',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _remarkController,
                      decoration: const InputDecoration(
                        labelText: '备注',
                        border: OutlineInputBorder(),
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _loading ? null : _submit,
                        child: Text(_loading ? '生成中...' : '生成激活码'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Card(
              color: Colors.red.shade50,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(
                  _error!,
                  style: TextStyle(color: Colors.red.shade900),
                ),
              ),
            ),
          ],
          if (_result != null) ...[
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '生成结果',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        OutlinedButton.icon(
                          onPressed: _copyAllItems,
                          icon: const Icon(Icons.copy_all_outlined),
                          label: const Text('复制全部'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _InfoChip(label: '数量', value: '${_result!.count}'),
                        _InfoChip(label: '天数', value: '${_result!.durationDays}'),
                        _InfoChip(label: '批次', value: _result!.batchId ?? '-'),
                        _InfoChip(label: '起始用户', value: _result!.startUserId ?? '-'),
                        _InfoChip(label: '结束用户', value: _result!.endUserId ?? '-'),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            ..._result!.items.map(
              (item) => Card(
                child: ListTile(
                  title: SelectableText(item.code),
                  subtitle: Text('用户ID: ${item.userId}'),
                  trailing: IconButton(
                    onPressed: () => _copyItem(item),
                    icon: const Icon(Icons.copy_outlined),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  bool get wantKeepAlive => true;
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: Theme.of(context).colorScheme.secondaryContainer,
      ),
      child: Text('$label: $value'),
    );
  }
}
