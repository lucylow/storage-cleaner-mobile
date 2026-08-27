export type AIActionPolicy = {
  canRecommend: boolean;
  canAutoSelect: boolean;
  canDelete: boolean;
};

export function getAIActionPolicy(): AIActionPolicy {
  return {
    canRecommend: true,
    canAutoSelect: true,
    canDelete: false,
  };
}
