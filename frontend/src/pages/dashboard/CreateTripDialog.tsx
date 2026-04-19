import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useCreateTripMutation } from '../../hooks/useTripMutations';
import type { CreateTripBody } from '../../types/trip';

export interface CreateTripDialogHandle {
  open: () => void;
  close: () => void;
}

type TemplateValue = 'empty' | 'current';

interface FormState {
  name: string;
  destination: string;
  description: string;
  startDate: string;
  endDate: string;
  template: TemplateValue;
}

const INITIAL_FORM: FormState = {
  name: '',
  destination: '',
  description: '',
  startDate: '',
  endDate: '',
  template: 'empty',
};

/**
 * 封装原生 <dialog> 的新建行程模态。父组件通过 ref.open() / ref.close() 控制,
 * 避免 Dashboard 再维护一个 isOpen state。
 *
 * - 表单字段本地 useState,受控输入
 * - 校验:name 必填;endDate 不早于 startDate
 * - 提交走 useCreateTripMutation,成功后 hook 自动跳转 /trip?id=xxx
 * - 失败时在 .dialog-error 里显示后端错误,不吞错
 */
export const CreateTripDialog = forwardRef<CreateTripDialogHandle>((_props, ref) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);
  const mutation = useCreateTripMutation();

  const resetAndOpen = useCallback(() => {
    setForm(INITIAL_FORM);
    setValidationError(null);
    mutation.reset();
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    // 对齐原生版:稍微延后 focus,等 dialog 挂好
    window.setTimeout(() => nameInputRef.current?.focus(), 30);
  }, [mutation]);

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      open: resetAndOpen,
      close,
    }),
    [resetAndOpen, close],
  );

  const handleChange = (field: keyof FormState) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value } as FormState));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    const startDate = form.startDate.trim();
    const endDate = form.endDate.trim();
    if (!name) {
      setValidationError('请填写行程名称');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setValidationError('结束日期不能早于开始日期');
      return;
    }
    setValidationError(null);

    const payload: CreateTripBody = {
      name,
      destination: form.destination.trim() || undefined,
      description: form.description.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      template: form.template,
    };

    mutation.mutate(payload, {
      onSuccess: () => {
        close();
      },
    });
  };

  const errorMessage =
    validationError ?? (mutation.isError ? mutation.error.message : null);

  return (
    <dialog
      ref={dialogRef}
      className="create-dialog"
      onClose={() => {
        // 用户按 ESC 关闭时,重置 mutation 错误,下次打开是干净的
        mutation.reset();
        setValidationError(null);
      }}
    >
      <form method="dialog" onSubmit={handleSubmit}>
        <h2>新建行程</h2>
        <label className="field">
          <span>
            名称 <em className="req">*</em>
          </span>
          <input
            ref={nameInputRef}
            name="name"
            type="text"
            required
            placeholder="比如:京都 5 日游"
            autoComplete="off"
            value={form.name}
            onChange={handleChange('name')}
          />
        </label>
        <label className="field">
          <span>目的地(可选)</span>
          <input
            name="destination"
            type="text"
            placeholder="比如:日本关西"
            autoComplete="off"
            value={form.destination}
            onChange={handleChange('destination')}
          />
        </label>
        <label className="field">
          <span>描述(可选)</span>
          <textarea
            name="description"
            rows={2}
            placeholder="行程说明、同行人员等"
            value={form.description}
            onChange={handleChange('description')}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>开始日期</span>
            <input
              name="startDate"
              type="date"
              value={form.startDate}
              onChange={handleChange('startDate')}
            />
          </label>
          <label className="field">
            <span>结束日期</span>
            <input
              name="endDate"
              type="date"
              value={form.endDate}
              onChange={handleChange('endDate')}
            />
          </label>
        </div>
        <fieldset className="template-group">
          <legend>模板</legend>
          <label className="radio-row">
            <input
              type="radio"
              name="template"
              value="empty"
              checked={form.template === 'empty'}
              onChange={() => setForm((prev) => ({ ...prev, template: 'empty' }))}
            />
            <div>
              <strong>空白</strong>
              <small>从零开始,景点和路线都为空</small>
            </div>
          </label>
          <label className="radio-row">
            <input
              type="radio"
              name="template"
              value="current"
              checked={form.template === 'current'}
              onChange={() => setForm((prev) => ({ ...prev, template: 'current' }))}
            />
            <div>
              <strong>基于当前默认行程</strong>
              <small>保留地图配置和日配色,景点路线清空</small>
            </div>
          </label>
        </fieldset>
        <div className="dialog-actions">
          <button type="button" value="cancel" onClick={close}>
            取消
          </button>
          <button type="submit" className="primary-btn" disabled={mutation.isPending}>
            {mutation.isPending ? '创建中...' : '创建并进入'}
          </button>
        </div>
        {errorMessage ? <p className="dialog-error">{errorMessage}</p> : null}
      </form>
    </dialog>
  );
});

CreateTripDialog.displayName = 'CreateTripDialog';
