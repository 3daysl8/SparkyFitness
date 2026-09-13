import type React from 'react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useWaterContainersQuery,
  useCreateWaterContainerMutation,
  useUpdateWaterContainerMutation,
  useDeleteWaterContainerMutation,
  useSetPrimaryWaterContainerMutation,
  useDrinkPresetCatalogQuery,
  useMaterializeDrinkPresetMutation,
} from '@/hooks/Settings/useWaterContainers';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import type { WaterContainer } from '@/types/settings';
import { Droplet, X, Edit2, Plus, Coffee, Beer, Sparkles } from 'lucide-react';

const WaterContainerManager: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [volume, setVolume] = useState<number | ''>('');
  const [unit, setUnit] = useState<'ml' | 'oz' | 'liter'>('ml');
  const [servingsPerContainer, setServingsPerContainer] = useState<number | ''>(
    1
  );
  const [hydrationFactor, setHydrationFactor] = useState<number>(1.0);

  // Edit container dialog state
  const [editingContainer, setEditingContainer] =
    useState<WaterContainer | null>(null);
  const [editName, setEditName] = useState('');
  const [editVolume, setEditVolume] = useState<number | ''>('');
  const [editUnit, setEditUnit] = useState<'ml' | 'oz' | 'liter'>('ml');
  const [editServings, setEditServings] = useState<number | ''>(1);
  const [editHydrationFactor, setEditHydrationFactor] = useState<number>(1.0);

  // Catalog dialog state
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [catalogKindFilter, setCatalogKindFilter] = useState<
    'all' | 'caffeine' | 'alcohol'
  >('all');

  const { data: containers = [] } = useWaterContainersQuery(user?.activeUserId);
  const { data: catalog = [] } = useDrinkPresetCatalogQuery();
  const { mutateAsync: createWaterContainer } =
    useCreateWaterContainerMutation();
  const { mutateAsync: updateWaterContainer } =
    useUpdateWaterContainerMutation();
  const { mutateAsync: deleteWaterContainer } =
    useDeleteWaterContainerMutation();
  const { mutateAsync: setPrimaryWaterContainer } =
    useSetPrimaryWaterContainerMutation();
  const { mutateAsync: materializeDrinkPreset, isPending: addingPreset } =
    useMaterializeDrinkPresetMutation();

  const standardContainers = useMemo(
    () => containers.filter((c) => !c.is_quick_add),
    [containers]
  );

  const quickAddPresets = useMemo(
    () => containers.filter((c) => !!c.is_quick_add),
    [containers]
  );

  const filteredCatalog = useMemo(() => {
    if (catalogKindFilter === 'all') return catalog;
    return catalog.filter((entry) => entry.kind === catalogKindFilter);
  }, [catalog, catalogKindFilter]);

  const convertToMl = (val: number, selectedUnit: 'ml' | 'oz' | 'liter') => {
    if (selectedUnit === 'oz') return Math.round(val * 29.5735);
    if (selectedUnit === 'liter') return Math.round(val * 1000);
    return Math.round(val);
  };

  const handleAddContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || volume === '') return;

    try {
      const volumeInMl = convertToMl(Number(volume), unit);
      await createWaterContainer({
        name: name.trim(),
        volume: volumeInMl,
        servings_per_container:
          servingsPerContainer !== '' ? Number(servingsPerContainer) : 1,
        hydration_factor: hydrationFactor,
        is_quick_add: false,
      });

      setName('');
      setVolume('');
      setServingsPerContainer(1);
      setHydrationFactor(1.0);
      toast({
        title: t('common.success', 'Success'),
        description: t('water.containerAdded', 'Container added successfully.'),
      });
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('water.containerAddFailed', 'Failed to add container.'),
        variant: 'destructive',
      });
    }
  };

  const handleOpenEdit = (container: WaterContainer) => {
    setEditingContainer(container);
    setEditName(container.name);
    setEditVolume(container.volume);
    setEditUnit('ml');
    setEditServings(container.servings_per_container || 1);
    setEditHydrationFactor(container.hydration_factor ?? 1.0);
  };

  const handleSaveEdit = async () => {
    if (!editingContainer || !editName.trim() || editVolume === '') return;

    try {
      const volumeInMl = convertToMl(Number(editVolume), editUnit);
      await updateWaterContainer({
        id: editingContainer.id,
        containerData: {
          name: editName.trim(),
          volume: volumeInMl,
          servings_per_container:
            editServings !== '' ? Number(editServings) : 1,
          hydration_factor: editHydrationFactor,
        },
      });

      setEditingContainer(null);
      toast({
        title: t('common.success', 'Success'),
        description: t('water.containerUpdated', 'Container updated.'),
      });
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('water.containerUpdateFailed', 'Failed to update.'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteWaterContainer(id);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('water.containerDeleteFailed', 'Failed to delete.'),
        variant: 'destructive',
      });
    }
  };

  const handleSetPrimary = async (id: number) => {
    try {
      await setPrimaryWaterContainer(id);
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('water.primaryUpdateFailed', 'Failed to set primary.'),
        variant: 'destructive',
      });
    }
  };

  const handleAddFromCatalog = async (catalogId: string) => {
    try {
      await materializeDrinkPreset(catalogId);
      toast({
        title: t('common.success', 'Success'),
        description: t('water.presetAdded', 'Preset added from catalog.'),
      });
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('water.presetAddFailed', 'Failed to add preset.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Droplet className="h-5 w-5 text-blue-500" />
            {t('water.containersTitle', 'Hydration Containers')}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCatalogDialogOpen(true)}
            className="gap-1 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('water.browsePresets', 'Browse Presets')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add Container Form */}
          <form
            onSubmit={handleAddContainer}
            className="space-y-4 rounded-xl border bg-muted/20 p-4"
          >
            <h4 className="text-sm font-semibold">
              {t('water.addContainer', 'Add New Container')}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="container-name" className="text-xs">
                  {t('water.containerName', 'Name')}
                </Label>
                <Input
                  id="container-name"
                  placeholder="e.g. Gym Bottle, Pint Glass"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="container-volume" className="text-xs">
                  {t('water.volume', 'Volume')}
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    id="container-volume"
                    type="number"
                    step="any"
                    placeholder="e.g. 500"
                    value={volume}
                    onChange={(e) =>
                      setVolume(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    className="h-9 text-xs flex-1"
                    required
                  />
                  <Select
                    value={unit}
                    onValueChange={(v) => setUnit(v as 'ml' | 'oz' | 'liter')}
                  >
                    <SelectTrigger className="h-9 w-20 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="oz">oz</SelectItem>
                      <SelectItem value="liter">L</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="container-servings" className="text-xs">
                  {t('water.servingsPerContainer', 'Servings (per fill)')}
                </Label>
                <Input
                  id="container-servings"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="1"
                  value={servingsPerContainer}
                  onChange={(e) =>
                    setServingsPerContainer(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="container-hydration-factor" className="text-xs">
                  {t('water.hydrationFactor', 'Hydration Ratio')}
                </Label>
                <Input
                  id="container-hydration-factor"
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="2.0"
                  placeholder="1.0"
                  value={hydrationFactor}
                  onChange={(e) => setHydrationFactor(Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm" className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                {t('common.add', 'Add Container')}
              </Button>
            </div>
          </form>

          {/* Standard Containers List */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('water.myContainers', 'My Containers')}
            </h4>
            {standardContainers.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                {t('water.noContainers', 'No containers added yet.')}
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {standardContainers.map((container) => (
                  <div
                    key={container.id}
                    className="flex items-center justify-between p-3 rounded-xl border bg-card hover:shadow-sm transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-xs truncate">
                          {container.name}
                        </p>
                        {container.is_primary && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          >
                            {t('water.primary', 'Primary')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {container.volume} ml
                        {container.hydration_factor !== 1.0 &&
                          ` • ${Math.round(container.hydration_factor * 100)}% hydration`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!container.is_primary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] px-2"
                          onClick={() => handleSetPrimary(container.id)}
                        >
                          {t('water.setPrimary', 'Make primary')}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => handleOpenEdit(container)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(container.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick-Add Presets */}
          {quickAddPresets.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('water.quickAddPresets', 'Quick-Add Drink Presets')}
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {quickAddPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between p-3 rounded-xl border bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs truncate">
                        {preset.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {preset.volume} ml
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(preset.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Container Dialog */}
      <Dialog
        open={!!editingContainer}
        onOpenChange={(open) => !open && setEditingContainer(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t('water.editContainer', 'Edit Container')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">
                {t('water.containerName', 'Name')}
              </Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('water.volume', 'Volume')}</Label>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  step="any"
                  value={editVolume}
                  onChange={(e) =>
                    setEditVolume(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  className="h-9 text-xs flex-1"
                />
                <Select
                  value={editUnit}
                  onValueChange={(v) => setEditUnit(v as 'ml' | 'oz' | 'liter')}
                >
                  <SelectTrigger className="h-9 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="oz">oz</SelectItem>
                    <SelectItem value="liter">L</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {t('water.servingsPerContainer', 'Servings')}
              </Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={editServings}
                onChange={(e) =>
                  setEditServings(
                    e.target.value === '' ? '' : Number(e.target.value)
                  )
                }
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {t('water.hydrationFactor', 'Hydration Ratio')}
              </Label>
              <Input
                type="number"
                step="0.05"
                min="0.1"
                max="2.0"
                value={editHydrationFactor}
                onChange={(e) => setEditHydrationFactor(Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingContainer(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleSaveEdit}>{t('common.save', 'Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preset Catalog Dialog */}
      <Dialog open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('water.presetCatalog', 'Drink Preset Catalog')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t(
                'water.presetCatalogDesc',
                'Add standard drink sizes and common beverages to your quick-access presets.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-1 border-b pb-2">
            {(['all', 'caffeine', 'alcohol'] as const).map((kind) => (
              <Button
                key={kind}
                variant={catalogKindFilter === kind ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs capitalize"
                onClick={() => setCatalogKindFilter(kind)}
              >
                {kind === 'caffeine' && <Coffee className="h-3 w-3 mr-1" />}
                {kind === 'alcohol' && <Beer className="h-3 w-3 mr-1" />}
                {kind}
              </Button>
            ))}
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2 py-2">
            {filteredCatalog.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-muted-foreground">
                    {item.volume} ml • {Math.round(item.hydration_factor * 100)}
                    % hydration
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleAddFromCatalog(item.id)}
                  disabled={addingPreset}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t('common.add', 'Add')}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WaterContainerManager;
