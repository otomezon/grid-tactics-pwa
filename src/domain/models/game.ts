export type MapEventAction =
  | { type: "show-message"; speaker?: string; text: string }
  | {
      type: "grant-item";
      speaker?: string;
      text: string;
      recipientUnitId: string;
      itemId: string;
      quantity: number;
    }
  | { type: "spawn-reinforcement"; speaker?: string; text: string; unit: GameUnit };

export interface MapEventDefinition {
  id: string;
  trigger: MapEventTrigger;
  action: MapEventAction;
}