import { useState } from "react";
import type { Profile } from "../../shared/business-contracts";
import { api, type Api, uploadPhoto } from "../client";
import { CITY_CONFIG, CITIES } from "../../shared/cities";
import { PhotoPicker } from "./PhotoPicker";
export function ProfileForm({
  profile,
  onSave,
  call = api,
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
  call?: Api;
}) {
  const [p, setP] = useState(profile),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(patch: unknown) {
    setBusy(true);
    try {
      const saved = await call<Profile>("profile.update", patch);
      onSave(saved);
      setMessage("已保存");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <section className="panel">
        <span className="eyebrow">ABOUT YOU</span>
        <h2>让合拍的人认识你</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({ bio: p.bio });
          }}
        >
          <label>
            个人介绍
            <textarea
              value={p.bio ?? ""}
              maxLength={500}
              onChange={(e) => setP({ ...p, bio: e.target.value })}
            />
          </label>
          <p className="note">
            介绍自己的工作、性格、兴趣和日常生活。将展示在你发布的帖子中；可单独保存或清空。
          </p>
          <button disabled={busy}>保存个人介绍</button>
        </form>
      </section>
      <section className="panel">
        <h2>资料与发布默认值</h2>
        <p className="note">
          填写后会自动带入发布表单，你仍可修改。保存资料不代表同意公开联系方式。
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save({
              nickname: p.nickname,
              occupation: p.occupation ?? "",
              gender: p.gender,
              city: p.city,
              district: p.district ?? "",
              budget: p.budget ?? null,
              moveIn: p.moveIn ?? "",
              leaseMonths: p.leaseMonths ?? null,
              roommateExpectations: p.roommateExpectations ?? "",
              housingPreferences: p.housingPreferences ?? "",
              contact: p.contact,
            });
          }}
        >
          <div className="form-grid">
            <label>
              昵称
              <input
                value={p.nickname}
                maxLength={30}
                onChange={(e) => setP({ ...p, nickname: e.target.value })}
              />
            </label>
            <label>
              职业
              <input
                value={p.occupation ?? ""}
                maxLength={40}
                onChange={(e) => setP({ ...p, occupation: e.target.value })}
              />
            </label>
            <label>
              性别
              <select
                value={p.gender}
                onChange={(e) =>
                  setP({ ...p, gender: e.target.value as Profile["gender"] })
                }
              >
                {["男", "女", "其他", "不透露"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              城市
              <select
                value={p.city}
                onChange={(e) =>
                  setP({ ...p, city: e.target.value, district: "" })
                }
              >
                {CITIES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              片区
              <select
                value={p.district ?? ""}
                onChange={(e) => setP({ ...p, district: e.target.value })}
              >
                <option value="">暂未确定</option>
                {CITY_CONFIG[p.city]?.districts.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              每月个人预算
              <input
                type="number"
                min={1}
                max={50000}
                value={p.budget ?? ""}
                onChange={(e) =>
                  setP({
                    ...p,
                    budget: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            <label>
              入住时间
              <input
                maxLength={40}
                value={p.moveIn ?? ""}
                onChange={(e) => setP({ ...p, moveIn: e.target.value })}
              />
            </label>
            <label>
              预计租多久（月）
              <input
                type="number"
                min={1}
                max={60}
                value={p.leaseMonths ?? ""}
                onChange={(e) =>
                  setP({
                    ...p,
                    leaseMonths: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
          </div>
          <label>
            求租偏好
            <textarea
              maxLength={500}
              value={p.housingPreferences ?? ""}
              onChange={(e) =>
                setP({ ...p, housingPreferences: e.target.value })
              }
            />
          </label>
          <label>
            室友期待
            <textarea
              maxLength={500}
              value={p.roommateExpectations ?? ""}
              onChange={(e) =>
                setP({ ...p, roommateExpectations: e.target.value })
              }
            />
          </label>
          <div className="form-grid">
            <label>
              微信（仅本人及获授权的帖子使用）
              <input
                maxLength={40}
                value={p.contact.wechat}
                onChange={(e) =>
                  setP({
                    ...p,
                    contact: { ...p.contact, wechat: e.target.value },
                  })
                }
              />
            </label>
            <label>
              手机（仅本人及获授权的帖子使用）
              <input
                maxLength={40}
                value={p.contact.phone}
                onChange={(e) =>
                  setP({
                    ...p,
                    contact: { ...p.contact, phone: e.target.value },
                  })
                }
              />
            </label>
          </div>
          <button disabled={busy}>保存资料</button>
        </form>
        <PhotoPicker
          max={1}
          ids={p.avatarUploadId ? [p.avatarUploadId] : []}
          upload={uploadPhoto}
          onChange={(ids) => {
            const avatarUploadId = ids[0] ?? null;
            setP({ ...p, avatarUploadId });
            void save({ avatarUploadId });
          }}
        />
      </section>
      <p role="status">{message}</p>
    </div>
  );
}
