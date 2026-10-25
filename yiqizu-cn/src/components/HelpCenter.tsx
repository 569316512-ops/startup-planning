import { useState } from "react";
import { api } from "../client";
export function HelpCenter() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel help">
      <h2>使用与隐私说明</h2>
      <p>
        国内试用版使用独立账号和帖子，与原站账号、数据不互通。账号尚未经过邮箱或身份核验，房东、中介身份为发布者自述。
      </p>
      <p>
        仅限年满18岁用户。免费每天发3帖、查看5个不同联系对象，北京时间零点重置；重复查看同一联系方式不重复扣次数。修改和撤回不返还发帖次数。
      </p>
      <p>
        联系方式不公开展示，发布时单独选择登录用户可看或仅运营可见。照片和帖子内容可能公开；个人介绍来自“我的”资料。超过半年内容停止展示并清理，已签发图片链接最长可继续访问5分钟。
      </p>
      <p>
        登录保存在当前标签页，关闭后可能需要重新登录。暂未开通邮件找回，请妥善保存密码；运营不能仅凭自述邮箱重置账号。
      </p>
      <p>
        请核实房源、身份和合同，看房前不要转账。平台不收租金、押金或会员费。
      </p>
      <h3>反馈 / 隐私请求 / 举报</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const data = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await api("feedback.submit", {
              category: data.get("category"),
              content: data.get("content"),
              contact: data.get("contact"),
            });
            setMessage("反馈已提交，运营会查看处理。");
          } catch (err) {
            setMessage((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          反馈类型
          <select name="category">
            <option value="bug">使用问题</option>
            <option value="privacy">隐私请求</option>
            <option value="report">举报内容</option>
          </select>
        </label>
        <label>
          反馈内容
          <textarea name="content" required minLength={4} maxLength={2000} />
        </label>
        <label>
          回复方式（选填，仅运营可见）
          <input name="contact" maxLength={100} />
        </label>
        <button disabled={busy}>提交反馈</button>
        <p role="status">{message}</p>
      </form>
    </section>
  );
}
