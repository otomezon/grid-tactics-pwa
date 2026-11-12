import type { ChangeEvent } from "react";
import type { WeaponType } from "../domain/models/game";

export interface DeploymentLoadoutWeapon {
  id: string;
  name: string;
  weaponType: WeaponType;
  power: number;
  hit: number;
  critical: number;
  minRange: number;
  maxRange: number;
  isUsable: boolean;
}

interface DeploymentLoadoutEditorProps {
  unitId: string;
  unitName: string;
  equippedWeaponId: string | null;
  weapons: readonly DeploymentLoadoutWeapon[];
  disabled: boolean;
  onChange: (weaponId: string | null) => void;
}

const WEAPON_TYPE_LABELS: Record<WeaponType, string> = {
  sword: "剣",
  lance: "槍",
  axe: "斧",
  bow: "弓",
  magic: "魔法"
};

export function DeploymentLoadoutEditor({
  unitId,
  unitName,
  equippedWeaponId,
  weapons,
  disabled,
  onChange
}: DeploymentLoadoutEditorProps) {
  const seen = new Set<string>();
  const selectableWeapons = weapons.filter((weapon) => {
    if (!weapon.isUsable || seen.has(weapon.id)) return false;
    seen.add(weapon.id);
    return true;
  });
  const selectId = "deployment-weapon-" + unitId;

  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    onChange(event.target.value || null);
  }

  return (
    <section className="deployment-loadout-editor" aria-labelledby={selectId + "-heading"} data-testid="deployment-loadout-editor">
      <div>
        <h4 id={selectId + "-heading"}>出撃時の装備</h4>
        <p>所持している使用可能な武器を選べます。武器を外すと未装備になります。</p>
      </div>
      <label htmlFor={selectId}>{unitName}の装備武器</label>
      <select
        id={selectId}
        aria-label={unitName + "の装備武器"}
        data-testid="deployment-loadout-select"
        value={equippedWeaponId ?? ""}
        disabled={disabled}
        onChange={handleChange}
      >
        <option value="">未装備</option>
        {selectableWeapons.map((weapon) => (
          <option value={weapon.id} key={weapon.id}>
            {weapon.name}（{WEAPON_TYPE_LABELS[weapon.weaponType]}） · 威力 {weapon.power} · 命中 {weapon.hit}% · 射程 {weapon.minRange}-{weapon.maxRange}
          </option>
        ))}
      </select>
      <p className="deployment-loadout-note">出撃予定・控え予定のどちらも変更できます。変更内容は「出撃メンバーと配置を確定して戦闘開始」を押したときに保存されます。</p>
    </section>
  );
}
