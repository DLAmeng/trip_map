import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState, } from 'react';
import { useCreateTripMutation } from '../../hooks/useTripMutations';
const INITIAL_FORM = {
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
export const CreateTripDialog = forwardRef((_props, ref) => {
    const dialogRef = useRef(null);
    const nameInputRef = useRef(null);
    const [form, setForm] = useState(INITIAL_FORM);
    const [validationError, setValidationError] = useState(null);
    const mutation = useCreateTripMutation();
    const resetAndOpen = useCallback(() => {
        setForm(INITIAL_FORM);
        setValidationError(null);
        mutation.reset();
        const dialog = dialogRef.current;
        if (!dialog)
            return;
        if (typeof dialog.showModal === 'function') {
            dialog.showModal();
        }
        else {
            dialog.setAttribute('open', '');
        }
        // 对齐原生版:稍微延后 focus,等 dialog 挂好
        window.setTimeout(() => nameInputRef.current?.focus(), 30);
    }, [mutation]);
    const close = useCallback(() => {
        const dialog = dialogRef.current;
        if (dialog?.open)
            dialog.close();
    }, []);
    useImperativeHandle(ref, () => ({
        open: resetAndOpen,
        close,
    }), [resetAndOpen, close]);
    const handleChange = (field) => (event) => {
        const value = event.target.value;
        setForm((prev) => ({ ...prev, [field]: value }));
    };
    const handleSubmit = (event) => {
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
        const payload = {
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
    const errorMessage = validationError ?? (mutation.isError ? mutation.error.message : null);
    return (_jsx("dialog", { ref: dialogRef, className: "create-dialog", onClose: () => {
            // 用户按 ESC 关闭时,重置 mutation 错误,下次打开是干净的
            mutation.reset();
            setValidationError(null);
        }, children: _jsxs("form", { method: "dialog", onSubmit: handleSubmit, children: [_jsx("h2", { children: "\u65B0\u5EFA\u884C\u7A0B" }), _jsxs("label", { className: "field", children: [_jsxs("span", { children: ["\u540D\u79F0 ", _jsx("em", { className: "req", children: "*" })] }), _jsx("input", { ref: nameInputRef, name: "name", type: "text", required: true, placeholder: "\u6BD4\u5982:\u4EAC\u90FD 5 \u65E5\u6E38", autoComplete: "off", value: form.name, onChange: handleChange('name') })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "\u76EE\u7684\u5730(\u53EF\u9009)" }), _jsx("input", { name: "destination", type: "text", placeholder: "\u6BD4\u5982:\u65E5\u672C\u5173\u897F", autoComplete: "off", value: form.destination, onChange: handleChange('destination') })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "\u63CF\u8FF0(\u53EF\u9009)" }), _jsx("textarea", { name: "description", rows: 2, placeholder: "\u884C\u7A0B\u8BF4\u660E\u3001\u540C\u884C\u4EBA\u5458\u7B49", value: form.description, onChange: handleChange('description') })] }), _jsxs("div", { className: "field-row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "\u5F00\u59CB\u65E5\u671F" }), _jsx("input", { name: "startDate", type: "date", value: form.startDate, onChange: handleChange('startDate') })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "\u7ED3\u675F\u65E5\u671F" }), _jsx("input", { name: "endDate", type: "date", value: form.endDate, onChange: handleChange('endDate') })] })] }), _jsxs("fieldset", { className: "template-group", children: [_jsx("legend", { children: "\u6A21\u677F" }), _jsxs("label", { className: "radio-row", children: [_jsx("input", { type: "radio", name: "template", value: "empty", checked: form.template === 'empty', onChange: () => setForm((prev) => ({ ...prev, template: 'empty' })) }), _jsxs("div", { children: [_jsx("strong", { children: "\u7A7A\u767D" }), _jsx("small", { children: "\u4ECE\u96F6\u5F00\u59CB,\u666F\u70B9\u548C\u8DEF\u7EBF\u90FD\u4E3A\u7A7A" })] })] }), _jsxs("label", { className: "radio-row", children: [_jsx("input", { type: "radio", name: "template", value: "current", checked: form.template === 'current', onChange: () => setForm((prev) => ({ ...prev, template: 'current' })) }), _jsxs("div", { children: [_jsx("strong", { children: "\u57FA\u4E8E\u5F53\u524D\u9ED8\u8BA4\u884C\u7A0B" }), _jsx("small", { children: "\u4FDD\u7559\u5730\u56FE\u914D\u7F6E\u548C\u65E5\u914D\u8272,\u666F\u70B9\u8DEF\u7EBF\u6E05\u7A7A" })] })] })] }), _jsxs("div", { className: "dialog-actions", children: [_jsx("button", { type: "button", value: "cancel", onClick: close, children: "\u53D6\u6D88" }), _jsx("button", { type: "submit", className: "primary-btn", disabled: mutation.isPending, children: mutation.isPending ? '创建中...' : '创建并进入' })] }), errorMessage ? _jsx("p", { className: "dialog-error", children: errorMessage }) : null] }) }));
});
CreateTripDialog.displayName = 'CreateTripDialog';
