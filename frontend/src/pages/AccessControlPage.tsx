import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Filter,
  MapPin,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import {
  savePermissions,
  searchOrganisations,
  type AccessMatrixData,
  type CrudFlags,
  type OrganisationItem,
  type PermissionUpdateItem,
} from "../api/accessControl";
import useAccessMatrix from "../hooks/data/useAccessMatrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ActionKey = keyof CrudFlags; // "read" | "create" | "update" | "delete"

const ACTION_CONFIG: Record<
  ActionKey,
  { label: string; short: string; activeClass: string; inactiveClass: string }
> = {
  read: {
    label: "Read",
    short: "R",
    activeClass: "bg-blue-600 text-white border-blue-600 hover:bg-blue-700",
    inactiveClass: "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200",
  },
  create: {
    label: "Create",
    short: "C",
    activeClass: "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700",
    inactiveClass: "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200",
  },
  update: {
    label: "Update",
    short: "U",
    activeClass: "bg-amber-600 text-white border-amber-600 hover:bg-amber-700",
    inactiveClass: "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200",
  },
  delete: {
    label: "Delete",
    short: "D",
    activeClass: "bg-rose-600 text-white border-rose-600 hover:bg-rose-700",
    inactiveClass: "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200",
  },
};

export default function AccessControlPage() {
  const [saving, setSaving] = useState(false);

  // Scope State: 0 = All Levels (Global), >0 = Tier Level (1=International, 2=National, etc.)
  const [selectedHierarchyLevel, setSelectedHierarchyLevel] = useState<number>(0);
  const [selectedOrgId, setSelectedOrgId] = useState<number>(0);
  const [selectedOrgName, setSelectedOrgName] = useState<string>("");

  const {
    matrix: data,
    matrixLoading,
    matrixFetching,
    matrixError,
    refetch,
    invalidateMatrix,
  } = useAccessMatrix({
    hierarchyLevel: selectedHierarchyLevel,
    orgId: selectedOrgId,
  });

  const loading = matrixLoading || matrixFetching;

  // Organisation search popup / state
  const [orgSearchText, setOrgSearchText] = useState("");
  const [orgSearchResults, setOrgSearchResults] = useState<OrganisationItem[]>([]);
  const [searchingOrgs, setSearchingOrgs] = useState(false);
  const [showOrgPicker, setShowOrgPicker] = useState(false);

  // Local state tracking modified cells: key = `${moduleId}:${roleCode}`
  const [cellState, setCellState] = useState<Record<string, CrudFlags>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());

  // Search & Filter
  const [searchModule, setSearchModule] = useState("");
  const [searchRole, setSearchRole] = useState("");
  const [selectedModuleCategory, setSelectedModuleCategory] = useState<string>("ALL");
  const [selectedRoleCategory, setSelectedRoleCategory] = useState<string>("ALL");

  // Batch edit dialog state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchModuleCode, setBatchModuleCode] = useState<string>("");
  const [batchRoles, setBatchRoles] = useState<string[]>([]);
  const [batchRoleSearch, setBatchRoleSearch] = useState("");
  const [batchCrud, setBatchCrud] = useState<CrudFlags>({
    read: true,
    create: true,
    update: false,
    delete: false,
  });

  const resetCellState = (matrix: AccessMatrixData | null) => {
    if (!matrix) return;
    const initial: Record<string, CrudFlags> = {};
    for (const mod of matrix.modules) {
      for (const role of matrix.roles) {
        const key = `${mod.moduleId}:${role.code}`;
        initial[key] = {
          ...(mod.permissionsByRole[role.code] || {
            read: false,
            create: false,
            update: false,
            delete: false,
          }),
        };
      }
    }
    setCellState(initial);
    setDirtyKeys(new Set());
  };

  useEffect(() => {
    resetCellState(data);
  }, [data]);

  useEffect(() => {
    if (matrixError) {
      toast.error(matrixError);
    }
  }, [matrixError]);

  // Organisation search handler with debounce
  useEffect(() => {
    if (!showOrgPicker || orgSearchText.trim().length === 0) {
      setOrgSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingOrgs(true);
        const results = await searchOrganisations({ search: orgSearchText.trim() });
        setOrgSearchResults(results);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchingOrgs(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [orgSearchText, showOrgPicker]);

  // Unique module categories
  const moduleCategories = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const m of data.modules) {
      if (m.category) set.add(m.category);
    }
    return Array.from(set).sort();
  }, [data]);

  // Unique role categories
  const roleCategories = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const r of data.roles) {
      if (r.category) set.add(r.category);
    }
    return Array.from(set).sort();
  }, [data]);

  // Filtered roles (horizontal columns)
  const filteredRoles = useMemo(() => {
    if (!data) return [];
    return data.roles.filter((role) => {
      const matchSearch =
        searchRole.trim() === "" ||
        role.name.toLowerCase().includes(searchRole.toLowerCase()) ||
        role.code.toLowerCase().includes(searchRole.toLowerCase());

      const matchCategory =
        selectedRoleCategory === "ALL" || role.category === selectedRoleCategory;

      return matchSearch && matchCategory;
    });
  }, [data, searchRole, selectedRoleCategory]);

  // Filtered modules (vertical rows)
  const filteredModules = useMemo(() => {
    if (!data) return [];
    return data.modules.filter((mod) => {
      const matchSearch =
        searchModule.trim() === "" ||
        mod.moduleName.toLowerCase().includes(searchModule.toLowerCase()) ||
        mod.moduleCode.toLowerCase().includes(searchModule.toLowerCase());

      const matchCategory =
        selectedModuleCategory === "ALL" || mod.category === selectedModuleCategory;

      return matchSearch && matchCategory;
    });
  }, [data, searchModule, selectedModuleCategory]);

  // Toggle single action flag
  const toggleFlag = (moduleId: number, roleCode: string, action: ActionKey) => {
    const key = `${moduleId}:${roleCode}`;
    const current = cellState[key] || { read: false, create: false, update: false, delete: false };
    const nextVal = !current[action];

    const updated = {
      ...current,
      [action]: nextVal,
      // If giving create, update or delete, automatically enable read
      ...(nextVal && action !== "read" ? { read: true } : {}),
      // If revoking read, automatically revoke create, update, delete
      ...(!nextVal && action === "read" ? { create: false, update: false, delete: false } : {}),
    };

    setCellState((prev) => ({ ...prev, [key]: updated }));
    setDirtyKeys((prev) => new Set(prev).add(key));
  };

  // Active scope values: org override takes priority if set, otherwise tier level (0 = All Levels/Global)
  const currentHierarchyLevel = selectedOrgId > 0 ? 0 : selectedHierarchyLevel;
  const currentOrgId = selectedOrgId;
  const isScopedView = selectedHierarchyLevel > 0 || selectedOrgId > 0;

  // Save all modified permissions
  const handleSaveAll = async () => {
    if (dirtyKeys.size === 0) return;

    try {
      setSaving(true);
      const updates: PermissionUpdateItem[] = [];

      for (const key of dirtyKeys) {
        const [modIdStr, roleCode] = key.split(":");
        const moduleId = Number(modIdStr);
        const flags = cellState[key];

        if (flags) {
          updates.push({
            moduleId,
            role: roleCode,
            hierarchyLevel: currentHierarchyLevel,
            orgId: currentOrgId,
            canRead: flags.read,
            canCreate: flags.create,
            canUpdate: flags.update,
            canDelete: flags.delete,
          });
        }
      }

      await savePermissions(updates);
      toast.success(`Successfully saved ${updates.length} permission rule(s)`);
      setDirtyKeys(new Set());
      await invalidateMatrix();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  // Apply batch changes
  const handleApplyBatch = async () => {
    if (!batchModuleCode) {
      toast.error("Please select a module");
      return;
    }
    if (batchRoles.length === 0) {
      toast.error("Please select at least one role/designation");
      return;
    }

    try {
      setSaving(true);
      const updates: PermissionUpdateItem[] = batchRoles.map((role) => ({
        moduleCode: batchModuleCode,
        role,
        hierarchyLevel: currentHierarchyLevel,
        orgId: currentOrgId,
        canRead: batchCrud.read,
        canCreate: batchCrud.create,
        canUpdate: batchCrud.update,
        canDelete: batchCrud.delete,
      }));

      await savePermissions(updates);
      toast.success(`Applied permissions for ${batchModuleCode} across ${updates.length} role(s)`);
      setBatchModalOpen(false);
      await invalidateMatrix();
    } catch (err: any) {
      toast.error(err?.message || "Failed to apply batch permissions");
    } finally {
      setSaving(false);
    }
  };

  const handlePreset = (type: "ALL" | "READ_CREATE" | "READ_ONLY" | "NONE") => {
    if (type === "ALL") {
      setBatchCrud({ read: true, create: true, update: true, delete: true });
    } else if (type === "READ_CREATE") {
      setBatchCrud({ read: true, create: true, update: true, delete: false });
    } else if (type === "READ_ONLY") {
      setBatchCrud({ read: true, create: false, update: false, delete: false });
    } else {
      setBatchCrud({ read: false, create: false, update: false, delete: false });
    }
  };

  // Quick select helper in modal
  const handleQuickSelectRoles = (type: "ALL" | "SECRETARIES" | "CORE_EXEC" | "CLEAR") => {
    if (!data) return;
    if (type === "ALL") {
      setBatchRoles(data.roles.map((r) => r.code));
    } else if (type === "SECRETARIES") {
      const secCodes = data.roles
        .filter((r) => r.code.includes("SECRETARY") || r.category === "Secretaries")
        .map((r) => r.code);
      setBatchRoles(secCodes);
    } else if (type === "CORE_EXEC") {
      const execCodes = data.roles
        .filter(
          (r) =>
            r.code === "PRESIDENT" ||
            r.code === "GENERAL SECRETARY" ||
            r.code === "FINANCE SECRETARY" ||
            r.code === "VICE PRESIDENT",
        )
        .map((r) => r.code);
      setBatchRoles(execCodes);
    } else {
      setBatchRoles([]);
    }
  };

  const currentLevelName = useMemo(() => {
    if (!data || selectedHierarchyLevel === 0) return "Global";
    return data.hierarchyLevels.find((h) => h.level === selectedHierarchyLevel)?.name || `Level ${selectedHierarchyLevel}`;
  }, [data, selectedHierarchyLevel]);

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] lg:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700">
                <ShieldCheck className="size-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Access Control & Permissions
              </h1>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Configure CRUD privileges per module for committee roles globally, by organizational tier, or for a specific unit.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => void refetch()}
              disabled={loading || saving}
              className="gap-2"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={() => {
                if (data?.modules[0]) {
                  setBatchModuleCode(data.modules[0].moduleCode);
                }
                setBatchModalOpen(true);
              }}
              className="gap-2 bg-[#b89562] text-white hover:bg-[#a68453]"
            >
              <SlidersHorizontal className="size-4" />
              Quick Assign / Preset
            </Button>
          </div>
        </div>

        {/* Scope Selector Bar */}
        <div className="mt-6 rounded-xl border border-amber-200/70 bg-[#fdfbf7] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
                <span>Select Level / Scope</span>
                {isScopedView && (
                  <span className="rounded-md bg-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {selectedOrgId > 0 ? "Unit Override Mode" : "Tier Override Mode"}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {selectedOrgId > 0
                  ? `Rules apply exclusively to ${selectedOrgName}. Permissions not set here inherit from Global rules.`
                  : selectedHierarchyLevel > 0
                    ? `Rules apply to all committee roles at ${currentLevelName}. Overrides Global defaults for this level.`
                    : "Rules apply globally to all committees and units across the organization."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Single Level Selector Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-700 whitespace-nowrap">
                  Level:
                </label>
                <div className="w-56">
                  <NativeSelect
                    value={selectedOrgId > 0 ? "UNIT_OVERRIDE" : selectedHierarchyLevel}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== "UNIT_OVERRIDE") {
                        setSelectedHierarchyLevel(Number(val));
                        setSelectedOrgId(0);
                        setSelectedOrgName("");
                      }
                    }}
                    size="sm"
                    className="w-full bg-white"
                  >
                    <NativeSelectOption value={0}>All Levels (Global)</NativeSelectOption>
                    {data?.hierarchyLevels.map((h) => (
                      <NativeSelectOption key={h.level} value={h.level}>
                        {h.name} (Level {h.level})
                      </NativeSelectOption>
                    ))}
                    {selectedOrgId > 0 && (
                      <NativeSelectOption value="UNIT_OVERRIDE" disabled>
                        Specific Unit: {selectedOrgName}
                      </NativeSelectOption>
                    )}
                  </NativeSelect>
                </div>
              </div>

              {/* Specific Unit Override Button or Active Chip */}
              {selectedOrgId > 0 ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs">
                  <MapPin className="size-3.5 text-[#b89562]" />
                  <span className="font-semibold text-amber-950 max-w-[140px] truncate" title={selectedOrgName}>
                    {selectedOrgName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowOrgPicker(true)}
                    className="text-amber-700 hover:text-amber-900 font-medium underline text-[11px] ml-1"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrgId(0);
                      setSelectedOrgName("");
                    }}
                    className="ml-1 rounded p-0.5 text-gray-400 hover:bg-amber-200/50 hover:text-gray-700 font-bold"
                    title="Clear unit override"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowOrgPicker(true)}
                  className="h-8 gap-1.5 bg-white text-xs border-gray-200 text-gray-700 hover:border-amber-400 hover:bg-amber-50/30"
                >
                  <MapPin className="size-3.5 text-[#b89562]" />
                  Specific Unit Override
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-xs text-gray-600">
          <span className="font-semibold text-gray-700">Actions Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex size-5 items-center justify-center rounded border border-blue-600 bg-blue-600 font-bold text-white text-[10px]">
              R
            </span>
            <span>Read</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex size-5 items-center justify-center rounded border border-emerald-600 bg-emerald-600 font-bold text-white text-[10px]">
              C
            </span>
            <span>Create</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex size-5 items-center justify-center rounded border border-amber-600 bg-amber-600 font-bold text-white text-[10px]">
              U
            </span>
            <span>Update</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex size-5 items-center justify-center rounded border border-rose-600 bg-rose-600 font-bold text-white text-[10px]">
              D
            </span>
            <span>Delete</span>
          </div>
          {isScopedView && (
            <div className="flex items-center gap-1.5 ml-2">
              <span className="inline-flex items-center rounded bg-gray-200 px-1.5 py-0.5 text-[9px] font-semibold text-gray-700">
                Inherited
              </span>
              <span>Cell falls back to Global rule</span>
            </div>
          )}
          <span className="ml-auto text-gray-400">
            * Super Users always hold full system-wide permissions.
          </span>
        </div>

        {/* Filters and Controls */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Module Filter */}
          <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/50 p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span className="flex items-center gap-1.5">
                <Filter className="size-3.5 text-[#b89562]" />
                Filter Modules ({filteredModules.length})
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchModule}
                  onChange={(e) => setSearchModule(e.target.value)}
                  placeholder="Search module name or code..."
                  className="h-8 pl-8 text-xs bg-white"
                />
              </div>
              <div className="w-full sm:w-48">
                <NativeSelect
                  value={selectedModuleCategory}
                  onChange={(e) => setSelectedModuleCategory(e.target.value)}
                  className="w-full bg-white"
                  size="sm"
                >
                  <NativeSelectOption value="ALL">All Categories</NativeSelectOption>
                  {moduleCategories.map((cat) => (
                    <NativeSelectOption key={cat} value={cat}>
                      {cat}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>

          {/* Role Filter */}
          <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/50 p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5 text-[#b89562]" />
                Filter Roles / Designations ({filteredRoles.length})
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchRole}
                  onChange={(e) => setSearchRole(e.target.value)}
                  placeholder="Search role (e.g. Secretary, Finance)..."
                  className="h-8 pl-8 text-xs bg-white"
                />
              </div>
              <div className="w-full sm:w-48">
                <NativeSelect
                  value={selectedRoleCategory}
                  onChange={(e) => setSelectedRoleCategory(e.target.value)}
                  className="w-full bg-white"
                  size="sm"
                >
                  <NativeSelectOption value="ALL">All Categories</NativeSelectOption>
                  {roleCategories.map((cat) => (
                    <NativeSelectOption key={cat} value={cat}>
                      {cat}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Save Bar when pending changes exist */}
      {dirtyKeys.size > 0 && (
        <div className="sticky top-4 z-30 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg bg-amber-500 text-white">
              <Save className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                You have {dirtyKeys.size} unsaved change(s) for {isScopedView ? (currentHierarchyLevel > 0 ? currentLevelName : selectedOrgName) : "Global Scope"}
              </p>
              <p className="text-xs text-amber-700">
                Click &ldquo;Save All Changes&rdquo; to apply them immediately to the system.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => resetCellState(data)}
              disabled={saving}
              className="border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSaveAll()}
              disabled={saving}
              className="bg-amber-700 text-white hover:bg-amber-800"
            >
              {saving ? "Saving..." : "Save All Changes"}
            </Button>
          </div>
        </div>
      )}

      {/* Matrix Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="border-b border-gray-100 bg-[#faf8f5] text-xs font-semibold text-gray-700">
              <tr>
                <th className="sticky left-0 z-20 min-w-[260px] bg-[#faf8f5] px-6 py-4 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                  Module Name
                </th>
                {filteredRoles.map((role) => (
                  <th key={role.code} className="min-w-[170px] px-4 py-4 text-center">
                    <div className="font-semibold text-gray-900 line-clamp-1" title={role.name}>
                      {role.name}
                    </div>
                    <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[11px] font-normal text-gray-500">
                      <span className="rounded bg-amber-100/60 px-1.5 py-0.2 text-[10px] text-amber-800">
                        {role.category}
                      </span>
                      {role.isCabinet && (
                        <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-medium text-emerald-700">
                          Cabinet
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading && !data ? (
                <tr>
                  <td colSpan={filteredRoles.length + 1} className="py-12 text-center text-gray-500">
                    <RefreshCw className="mx-auto mb-2 size-6 animate-spin text-[#b89562]" />
                    Loading permissions matrix...
                  </td>
                </tr>
              ) : filteredModules.length === 0 ? (
                <tr>
                  <td colSpan={filteredRoles.length + 1} className="py-12 text-center text-gray-500">
                    No modules found matching search criteria
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-12 text-center text-gray-500">
                    No roles found matching &ldquo;{searchRole}&rdquo;
                  </td>
                </tr>
              ) : (
                filteredModules.map((mod) => (
                  <tr key={mod.moduleId} className="hover:bg-amber-50/20 transition-colors">
                    <td className="sticky left-0 z-10 bg-white px-6 py-4 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{mod.moduleName}</span>
                          {mod.parentCode && (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                              Submodule
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                          <code>{mod.moduleCode}</code>
                          <span>•</span>
                          <span>{mod.category}</span>
                        </div>
                      </div>
                    </td>

                    {filteredRoles.map((role) => {
                      const key = `${mod.moduleId}:${role.code}`;
                      const cell = cellState[key] || {
                        read: false,
                        create: false,
                        update: false,
                        delete: false,
                      };
                      const isDirty = dirtyKeys.has(key);
                      const isInherited = isScopedView && !isDirty && mod.inheritedFromGlobal?.[role.code];

                      return (
                        <td
                          key={role.code}
                          className={`px-4 py-3 text-center transition-colors ${
                            isDirty ? "bg-amber-50/60" : ""
                          }`}
                        >
                          <div className="inline-flex flex-col items-center gap-1">
                            <div className="inline-flex items-center gap-1.5 rounded-lg border border-gray-100 bg-white p-1 shadow-xs">
                              {(["read", "create", "update", "delete"] as ActionKey[]).map((act) => {
                                const active = cell[act];
                                const conf = ACTION_CONFIG[act];
                                return (
                                  <button
                                    key={act}
                                    type="button"
                                    onClick={() => toggleFlag(mod.moduleId, role.code, act)}
                                    title={`${conf.label}: ${active ? "Allowed" : "Restricted"} for ${role.name}${
                                      isInherited ? " (Inherited from Global)" : ""
                                    }`}
                                    className={`inline-flex size-6 items-center justify-center rounded text-xs font-bold transition-all border ${
                                      active ? conf.activeClass : conf.inactiveClass
                                    }`}
                                  >
                                    {conf.short}
                                  </button>
                                );
                              })}
                            </div>
                            {isInherited && (
                              <span className="text-[9px] text-gray-400">
                                Inherited
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Organisation Unit Picker Modal */}
      <Dialog open={showOrgPicker} onOpenChange={setShowOrgPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="size-5 text-[#b89562]" />
              Select Specific Organisation Unit
            </DialogTitle>
            <DialogDescription>
              Search by unit or division name to configure custom permissions for that specific unit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={orgSearchText}
                onChange={(e) => setOrgSearchText(e.target.value)}
                placeholder="Type unit or division name (e.g. Dubai, Sharjah)..."
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y rounded-lg border border-gray-200">
              {searchingOrgs ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  <RefreshCw className="mx-auto mb-1 size-4 animate-spin text-[#b89562]" />
                  Searching units...
                </div>
              ) : orgSearchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400">
                  {orgSearchText.trim().length === 0
                    ? "Type to search units or divisions"
                    : "No matching organisation units found"}
                </div>
              ) : (
                orgSearchResults.map((org) => (
                  <button
                    key={org.orgid}
                    type="button"
                    onClick={() => {
                      setSelectedOrgId(org.orgid);
                      setSelectedOrgName(org.orgname);
                      setShowOrgPicker(false);
                    }}
                    className="flex w-full items-center justify-between p-3 text-left hover:bg-amber-50/50 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{org.orgname}</div>
                      <div className="text-xs text-gray-500">
                        {org.hlevel ? `Level ${org.hlevel}` : "Unit"} • ID #{org.orgid}
                      </div>
                    </div>
                    <Check className="size-4 text-[#b89562] opacity-0 hover:opacity-100" />
                  </button>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowOrgPicker(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Assign / Preset Modal */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-[#b89562]" />
              Quick Assign / Batch Update by Role
            </DialogTitle>
            <DialogDescription>
              Select a module and apply CRUD privileges across committee roles for {isScopedView ? (currentHierarchyLevel > 0 ? currentLevelName : selectedOrgName) : "Global Scope"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Module Picker */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Target Module
              </label>
              <select
                value={batchModuleCode}
                onChange={(e) => setBatchModuleCode(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-hidden"
              >
                {data?.modules.map((m) => (
                  <option key={m.moduleCode} value={m.moduleCode}>
                    {m.moduleName} ({m.moduleCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Roles Multi-Select */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Target Roles / Designations ({batchRoles.length} selected)
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleQuickSelectRoles("SECRETARIES")}
                    className="font-medium text-amber-700 hover:underline"
                  >
                    All Secretaries
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleQuickSelectRoles("CORE_EXEC")}
                    className="font-medium text-amber-700 hover:underline"
                  >
                    Core Exec
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleQuickSelectRoles("ALL")}
                    className="font-medium text-amber-700 hover:underline"
                  >
                    All
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleQuickSelectRoles("CLEAR")}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Role filter within modal */}
              <div className="relative mt-2">
                <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-gray-400" />
                <Input
                  value={batchRoleSearch}
                  onChange={(e) => setBatchRoleSearch(e.target.value)}
                  placeholder="Filter roles list..."
                  className="h-8 pl-8 text-xs bg-white"
                />
              </div>

              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 p-2">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {data?.roles
                    .filter((r) =>
                      batchRoleSearch.trim() === ""
                        ? true
                        : r.name.toLowerCase().includes(batchRoleSearch.toLowerCase()) ||
                          r.code.toLowerCase().includes(batchRoleSearch.toLowerCase()),
                    )
                    .map((r) => {
                      const selected = batchRoles.includes(r.code);
                      return (
                        <button
                          key={r.code}
                          type="button"
                          onClick={() => {
                            setBatchRoles((prev) =>
                              selected ? prev.filter((c) => c !== r.code) : [...prev, r.code],
                            );
                          }}
                          className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs text-left font-medium transition-colors ${
                            selected
                              ? "border-[#b89562] bg-[#faf6f0] text-[#8c6b38]"
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <span className="line-clamp-1">{r.name}</span>
                          {selected && <Check className="size-3.5 shrink-0 ml-1 text-[#b89562]" />}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Permission Presets
              </label>
              <div className="mt-1 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => handlePreset("ALL")}
                  className="text-xs"
                >
                  Full Access (CRUD)
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => handlePreset("READ_CREATE")}
                  className="text-xs"
                >
                  Read &amp; Create
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => handlePreset("READ_ONLY")}
                  className="text-xs"
                >
                  Read-Only
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => handlePreset("NONE")}
                  className="text-xs text-rose-600 hover:text-rose-700"
                >
                  Restricted (None)
                </Button>
              </div>
            </div>

            {/* Granular CRUD Checkboxes */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <label className="text-xs font-semibold text-gray-700">Action Permissions</label>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["read", "create", "update", "delete"] as ActionKey[]).map((act) => {
                  const conf = ACTION_CONFIG[act];
                  const active = batchCrud[act];
                  return (
                    <label
                      key={act}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white p-2.5 text-xs font-medium shadow-2xs hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setBatchCrud((prev) => ({
                            ...prev,
                            [act]: checked,
                            ...(checked && act !== "read" ? { read: true } : {}),
                            ...(!checked && act === "read"
                              ? { create: false, update: false, delete: false }
                              : {}),
                          }));
                        }}
                        className="rounded border-gray-300 text-[#b89562] focus:ring-[#b89562]"
                      />
                      <span>{conf.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setBatchModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleApplyBatch()}
              disabled={saving}
              className="bg-[#b89562] text-white hover:bg-[#a68453]"
            >
              {saving ? "Applying..." : "Apply Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
