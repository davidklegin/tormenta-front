import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { treasuryApi } from '@/api';
import type { CampaignTreasury } from '@/api/types';

export const treasuryKeys = {
  campaign: (campaignId: number) => ['campaign-treasury', campaignId] as const,
};

/** O cofre do grupo. O evento `campaign.treasury.updated` o mantém em dia. */
export function useTreasury(campaignId: number | null | undefined, enabled = true) {
  return useQuery<CampaignTreasury>({
    queryKey: treasuryKeys.campaign(campaignId ?? 0),
    queryFn: () => treasuryApi.show(campaignId as number),
    enabled: Boolean(campaignId) && enabled,
    // Um 403 (quem não senta à mesa) não melhora tentando de novo.
    retry: false,
  });
}

export function useTreasuryMutations(campaignId: number) {
  const queryClient = useQueryClient();

  const guardar = (estado: CampaignTreasury) =>
    queryClient.setQueryData(treasuryKeys.campaign(campaignId), estado);

  const move = useMutation({
    mutationFn: (payload: { amount: number; description?: string | null }) =>
      treasuryApi.move(campaignId, payload),
    onSuccess: guardar,
  });

  const undo = useMutation({
    mutationFn: (entryId: number) => treasuryApi.undo(campaignId, entryId),
    onSuccess: guardar,
  });

  return { move, undo };
}
