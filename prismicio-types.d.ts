import type * as prismic from "@prismicio/client";

type Simplify<T> = { [KeyType in keyof T]: T[KeyType] };


type PickContentRelationshipFieldData<
	TRelationship extends prismic.CustomTypeModelFetchCustomTypeLevel1 | prismic.CustomTypeModelFetchCustomTypeLevel2 | prismic.CustomTypeModelFetchGroupLevel1 | prismic.CustomTypeModelFetchGroupLevel2,
	TData extends Record<string, prismic.AnyRegularField | prismic.GroupField | prismic.NestedGroupField | prismic.SliceZone>,
	TLang extends string
> = |
	// Content relationship fields
	{
		[TSubRelationship in Extract<
			TRelationship["fields"][number], prismic.CustomTypeModelFetchContentRelationshipLevel1
		> as TSubRelationship["id"]]:
			ContentRelationshipFieldWithData<TSubRelationship["customtypes"], TLang>;
	} &
	// Group
	{
		[TGroup in Extract<
			TRelationship["fields"][number], prismic.CustomTypeModelFetchGroupLevel1 | prismic.CustomTypeModelFetchGroupLevel2
		> as TGroup["id"]]:
			TData[TGroup["id"]] extends prismic.GroupField<infer TGroupData>
				? prismic.GroupField<PickContentRelationshipFieldData<TGroup, TGroupData, TLang>>
				: never
	} &
	// Other fields
	{
		[TFieldKey in Extract<TRelationship["fields"][number], string>]:
			TFieldKey extends keyof TData ? TData[TFieldKey] : never;
	};

type ContentRelationshipFieldWithData<
	TCustomType extends readonly (prismic.CustomTypeModelFetchCustomTypeLevel1 | string)[] | readonly (prismic.CustomTypeModelFetchCustomTypeLevel2 | string)[],
	TLang extends string = string
> = {
	[ID in Exclude<TCustomType[number], string>["id"]]:
		prismic.ContentRelationshipField<
			ID,
			TLang,
			PickContentRelationshipFieldData<
				Extract<TCustomType[number], { id: ID }>,
				Extract<prismic.Content.AllDocumentTypes, { type: ID }>["data"],
				TLang
			>
		>
}[Exclude<TCustomType[number], string>["id"]];

/**
 * Content for cta documents
 */
interface CtaDocumentData {
	/**
	 * label field in *cta*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: cta.label
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	label: prismic.KeyTextField;
	
	/**
	 * link field in *cta*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: cta.link
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, "Primary" | "Secondary">;
	
	/**
	 * icon field in *cta*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: cta.icon
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	icon: prismic.KeyTextField;
}

/**
 * cta document from Prismic
 *
 * - **API ID**: `cta`
 * - **Repeatable**: `true`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type CtaDocument<Lang extends string = string> = prismic.PrismicDocumentWithUID<Simplify<CtaDocumentData>, "cta", Lang>;

/**
 * Content for Discipline documents
 */
interface DisciplineDocumentData {
	/**
	 * name field in *Discipline*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: discipline.name
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	name: prismic.KeyTextField;
}

/**
 * Discipline document from Prismic
 *
 * - **API ID**: `discipline`
 * - **Repeatable**: `true`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type DisciplineDocument<Lang extends string = string> = prismic.PrismicDocumentWithUID<Simplify<DisciplineDocumentData>, "discipline", Lang>;

/**
 * Content for Division documents
 */
interface DivisionDocumentData {
	/**
	 * name field in *Division*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: division.name
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	name: prismic.KeyTextField;
}

/**
 * Division document from Prismic
 *
 * - **API ID**: `division`
 * - **Repeatable**: `true`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type DivisionDocument<Lang extends string = string> = prismic.PrismicDocumentWithUID<Simplify<DivisionDocumentData>, "division", Lang>;

/**
 * Item in *Fighter → disciplines*
 */
export interface FighterDocumentDataDisciplinesItem {
	/**
	 * discipline field in *Fighter → disciplines*
	 *
	 * - **Field Type**: Content Relationship
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.disciplines[].discipline
	 * - **Documentation**: https://prismic.io/docs/fields/content-relationship
	 */
	discipline: ContentRelationshipFieldWithData<[{"id":"discipline","fields":["name"]}]>;
}

/**
 * Item in *Fighter → badges*
 */
export interface FighterDocumentDataBadgesItem {
	/**
	 * label field in *Fighter → badges*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.badges[].label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	label: prismic.KeyTextField;
}

/**
 * Item in *Fighter → recent battles*
 */
export interface FighterDocumentDataRecentBattlesItem {
	/**
	 * result field in *Fighter → recent battles*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.recent_battles[].result
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	result: prismic.KeyTextField;
	
	/**
	 * date field in *Fighter → recent battles*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.recent_battles[].date
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	date: prismic.KeyTextField;
	
	/**
	 * opponent field in *Fighter → recent battles*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.recent_battles[].opponent
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	opponent: prismic.KeyTextField;
	
	/**
	 * event field in *Fighter → recent battles*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.recent_battles[].event
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	event: prismic.KeyTextField;
	
	/**
	 * method field in *Fighter → recent battles*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.recent_battles[].method
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	method: prismic.KeyTextField;
	
	/**
	 * round field in *Fighter → recent battles*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.recent_battles[].round
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	round: prismic.KeyTextField;
	
	/**
	 * youtube link field in *Fighter → recent battles*
	 *
	 * - **Field Type**: Embed
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.recent_battles[].youtube_link
	 * - **Documentation**: https://prismic.io/docs/fields/embed
	 */
	youtube_link: prismic.EmbedField
}

/**
 * Item in *Fighter → combat archive*
 */
export interface FighterDocumentDataCombatArchiveItem {
	/**
	 * image field in *Fighter → combat archive*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.combat_archive[].image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
}

/**
 * Content for Fighter documents
 */
interface FighterDocumentData {
	/**
	 * name field in *Fighter*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.name
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	name: prismic.KeyTextField;
	
	/**
	 * nickname field in *Fighter*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.nickname
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	nickname: prismic.KeyTextField;
	
	/**
	 * record field in *Fighter*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.record
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	record: prismic.KeyTextField;
	
	/**
	 * age field in *Fighter*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.age
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	age: prismic.KeyTextField;
	
	/**
	 * image field in *Fighter*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.image
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
	
	/**
	 * division field in *Fighter*
	 *
	 * - **Field Type**: Content Relationship
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.division
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/content-relationship
	 */
	division: ContentRelationshipFieldWithData<[{"id":"division","fields":["name"]}]>;
	
	/**
	 * disciplines field in *Fighter*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.disciplines[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	disciplines: prismic.GroupField<Simplify<FighterDocumentDataDisciplinesItem>>;
	
	/**
	 * badges field in *Fighter*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.badges[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	badges: prismic.GroupField<Simplify<FighterDocumentDataBadgesItem>>;
	
	/**
	 * height field in *Fighter*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.height
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	height: prismic.KeyTextField;
	
	/**
	 * reach field in *Fighter*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.reach
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	reach: prismic.KeyTextField;
	
	/**
	 * gym field in *Fighter*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.gym
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	gym: prismic.KeyTextField;
	
	/**
	 * from field in *Fighter*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.from
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	from: prismic.KeyTextField;
	
	/**
	 * history field in *Fighter*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.history
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	history: prismic.RichTextField;
	
	/**
	 * recent battles field in *Fighter*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.recent_battles[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	recent_battles: prismic.GroupField<Simplify<FighterDocumentDataRecentBattlesItem>>;
	
	/**
	 * instagram link field in *Fighter*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.instagram_link
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	instagram_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
	
	/**
	 * tapology link field in *Fighter*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.tapology_link
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	tapology_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
	
	/**
	 * combat archive field in *Fighter*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.combat_archive[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	combat_archive: prismic.GroupField<Simplify<FighterDocumentDataCombatArchiveItem>>;
	
	/**
	 * banner image field in *Fighter*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.banner_image
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	banner_image: prismic.ImageField<never>;
	
	/**
	 * fighting out of field in *Fighter*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighter.fighting_out_of
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	fighting_out_of: prismic.KeyTextField;
}

/**
 * Fighter document from Prismic
 *
 * - **API ID**: `fighter`
 * - **Repeatable**: `true`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type FighterDocument<Lang extends string = string> = prismic.PrismicDocumentWithUID<Simplify<FighterDocumentData>, "fighter", Lang>;

/**
 * Item in *Footer → social links*
 */
export interface FooterDocumentDataSocialLinksItem {
	/**
	 * icon field in *Footer → social links*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.social_links[].icon
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	icon: prismic.KeyTextField;
	
	/**
	 * link field in *Footer → social links*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.social_links[].link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Item in *Footer → navigation links*
 */
export interface FooterDocumentDataNavigationLinksItem {
	/**
	 * link field in *Footer → navigation links*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.navigation_links[].link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Item in *Footer → legal links*
 */
export interface FooterDocumentDataLegalLinksItem {
	/**
	 * link field in *Footer → legal links*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.legal_links[].link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Item in *Footer → contact links*
 */
export interface FooterDocumentDataContactLinksItem {
	/**
	 * link field in *Footer → contact links*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.contact_links[].link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Content for Footer documents
 */
interface FooterDocumentData {
	/**
	 * logo field in *Footer*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.logo
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	logo: prismic.ImageField<never>;
	
	/**
	 * about text field in *Footer*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.about_text
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	about_text: prismic.KeyTextField;
	
	/**
	 * social links field in *Footer*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.social_links[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	social_links: prismic.GroupField<Simplify<FooterDocumentDataSocialLinksItem>>;
	
	/**
	 * navigation heading field in *Footer*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.navigation_heading
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	navigation_heading: prismic.KeyTextField;
	
	/**
	 * navigation links field in *Footer*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.navigation_links[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	navigation_links: prismic.GroupField<Simplify<FooterDocumentDataNavigationLinksItem>>;
	
	/**
	 * legal heading field in *Footer*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.legal_heading
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	legal_heading: prismic.KeyTextField;
	
	/**
	 * legal links field in *Footer*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.legal_links[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	legal_links: prismic.GroupField<Simplify<FooterDocumentDataLegalLinksItem>>;
	
	/**
	 * contact field in *Footer*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.contact
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	contact: prismic.KeyTextField;
	
	/**
	 * contact links field in *Footer*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.contact_links[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	contact_links: prismic.GroupField<Simplify<FooterDocumentDataContactLinksItem>>;
	
	/**
	 * email field in *Footer*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: footer.email
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	email: prismic.KeyTextField;
}

/**
 * Footer document from Prismic
 *
 * - **API ID**: `footer`
 * - **Repeatable**: `false`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type FooterDocument<Lang extends string = string> = prismic.PrismicDocumentWithoutUID<Simplify<FooterDocumentData>, "footer", Lang>;

type HomePageDocumentDataSlicesSlice = HeroSectionSlice | UpcomingEventSlice | FeaturedFightersSlice | VideoHighlightsSlice | LatestNewsSlice | NewsletterSlice | SponsorLogosSlice | EventArchiveTableSlice | FeaturedEventHeroSlice | FeaturedVideoSlice | FightersSectionSlice | ImageGallerySlice | UpcomingEventsGridSlice | VenueInformationSlice

/**
 * Content for Home page documents
 */
interface HomePageDocumentData {
	/**
	 * Slice Zone field in *Home page*
	 *
	 * - **Field Type**: Slice Zone
	 * - **Placeholder**: *None*
	 * - **API ID Path**: home_page.slices[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/slices
	 */
	slices: prismic.SliceZone<HomePageDocumentDataSlicesSlice>;/**
	 * Meta Title field in *Home page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: A title of the page used for social media and search engines
	 * - **API ID Path**: home_page.meta_title
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_title: prismic.KeyTextField;
	
	/**
	 * Meta Description field in *Home page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: A brief summary of the page
	 * - **API ID Path**: home_page.meta_description
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_description: prismic.KeyTextField;
	
	/**
	 * Meta Image field in *Home page*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: home_page.meta_image
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	meta_image: prismic.ImageField<never>;
}

/**
 * Home page document from Prismic
 *
 * - **API ID**: `home_page`
 * - **Repeatable**: `false`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type HomePageDocument<Lang extends string = string> = prismic.PrismicDocumentWithoutUID<Simplify<HomePageDocumentData>, "home_page", Lang>;

/**
 * Item in *Media → badges*
 */
export interface MediaDocumentDataBadgesItem {
	/**
	 * name field in *Media → badges*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: media.badges[].name
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	name: prismic.KeyTextField;
}

/**
 * Content for Media documents
 */
interface MediaDocumentData {
	/**
	 * Media Type field in *Media*
	 *
	 * - **Field Type**: Content Relationship
	 * - **Placeholder**: *None*
	 * - **API ID Path**: media.media_type
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/content-relationship
	 */
	media_type: ContentRelationshipFieldWithData<[{"id":"media_type","fields":["name"]}]>;
	
	/**
	 * thumbnail field in *Media*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: media.thumbnail
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	thumbnail: prismic.ImageField<never>;
	
	/**
	 * title field in *Media*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: media.title
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * youtube link field in *Media*
	 *
	 * - **Field Type**: Embed
	 * - **Placeholder**: *None*
	 * - **API ID Path**: media.youtube_link
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/embed
	 */
	youtube_link: prismic.EmbedField
	
	/**
	 * badges field in *Media*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: media.badges[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	badges: prismic.GroupField<Simplify<MediaDocumentDataBadgesItem>>;
}

/**
 * Media document from Prismic
 *
 * - **API ID**: `media`
 * - **Repeatable**: `true`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type MediaDocument<Lang extends string = string> = prismic.PrismicDocumentWithUID<Simplify<MediaDocumentData>, "media", Lang>;

/**
 * Content for Media Type documents
 */
interface MediaTypeDocumentData {
	/**
	 * name field in *Media Type*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: media_type.name
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	name: prismic.KeyTextField;
}

/**
 * Media Type document from Prismic
 *
 * - **API ID**: `media_type`
 * - **Repeatable**: `true`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type MediaTypeDocument<Lang extends string = string> = prismic.PrismicDocumentWithUID<Simplify<MediaTypeDocumentData>, "media_type", Lang>;

type PageDocumentDataSlicesSlice = HeroSectionSlice | UpcomingEventSlice | FeaturedFightersSlice | LatestNewsSlice | VideoHighlightsSlice | NewsletterSlice | SponsorLogosSlice | EventArchiveTableSlice | FeaturedEventHeroSlice | UpcomingEventsGridSlice | VenueInformationSlice | FightersSectionSlice | FeaturedVideoSlice | ImageGallerySlice | MediaArchiveSlice | AboutUsCtaSlice | AboutUsHeroSlice | CultureCommunitySlice | MissionValuesGridSlice | OurStorySlice | TheArchitectsSlice

/**
 * Content for page documents
 */
interface PageDocumentData {
	/**
	 * Slice Zone field in *page*
	 *
	 * - **Field Type**: Slice Zone
	 * - **Placeholder**: *None*
	 * - **API ID Path**: page.slices[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/slices
	 */
	slices: prismic.SliceZone<PageDocumentDataSlicesSlice>;/**
	 * Meta Title field in *page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: A title of the page used for social media and search engines
	 * - **API ID Path**: page.meta_title
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_title: prismic.KeyTextField;
	
	/**
	 * Meta Description field in *page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: A brief summary of the page
	 * - **API ID Path**: page.meta_description
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_description: prismic.KeyTextField;
	
	/**
	 * Meta Image field in *page*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: page.meta_image
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	meta_image: prismic.ImageField<never>;
}

/**
 * page document from Prismic
 *
 * - **API ID**: `page`
 * - **Repeatable**: `true`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type PageDocument<Lang extends string = string> = prismic.PrismicDocumentWithUID<Simplify<PageDocumentData>, "page", Lang>;

interface PictureDocumentData {}

/**
 * Picture document from Prismic
 *
 * - **API ID**: `picture`
 * - **Repeatable**: `true`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type PictureDocument<Lang extends string = string> = prismic.PrismicDocumentWithUID<Simplify<PictureDocumentData>, "picture", Lang>;

type PrivacyPolicyDocumentDataSlicesSlice = PrivacyPolicySlice

/**
 * Content for Privacy Policy documents
 */
interface PrivacyPolicyDocumentData {
	/**
	 * Slice Zone field in *Privacy Policy*
	 *
	 * - **Field Type**: Slice Zone
	 * - **Placeholder**: *None*
	 * - **API ID Path**: privacy_policy.slices[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/slices
	 */
	slices: prismic.SliceZone<PrivacyPolicyDocumentDataSlicesSlice>;/**
	 * Meta Title field in *Privacy Policy*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: A title of the page used for social media and search engines
	 * - **API ID Path**: privacy_policy.meta_title
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_title: prismic.KeyTextField;
	
	/**
	 * Meta Description field in *Privacy Policy*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: A brief summary of the page
	 * - **API ID Path**: privacy_policy.meta_description
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_description: prismic.KeyTextField;
	
	/**
	 * Meta Image field in *Privacy Policy*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: privacy_policy.meta_image
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	meta_image: prismic.ImageField<never>;
}

/**
 * Privacy Policy document from Prismic
 *
 * - **API ID**: `privacy_policy`
 * - **Repeatable**: `false`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type PrivacyPolicyDocument<Lang extends string = string> = prismic.PrismicDocumentWithoutUID<Simplify<PrivacyPolicyDocumentData>, "privacy_policy", Lang>;

type TermsOfServiceDocumentDataSlicesSlice = TermsOfServiceSlice

/**
 * Content for Terms Of Service documents
 */
interface TermsOfServiceDocumentData {
	/**
	 * Slice Zone field in *Terms Of Service*
	 *
	 * - **Field Type**: Slice Zone
	 * - **Placeholder**: *None*
	 * - **API ID Path**: terms_of_service.slices[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/slices
	 */
	slices: prismic.SliceZone<TermsOfServiceDocumentDataSlicesSlice>;/**
	 * Meta Title field in *Terms Of Service*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: A title of the page used for social media and search engines
	 * - **API ID Path**: terms_of_service.meta_title
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_title: prismic.KeyTextField;
	
	/**
	 * Meta Description field in *Terms Of Service*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: A brief summary of the page
	 * - **API ID Path**: terms_of_service.meta_description
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_description: prismic.KeyTextField;
	
	/**
	 * Meta Image field in *Terms Of Service*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: terms_of_service.meta_image
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	meta_image: prismic.ImageField<never>;
}

/**
 * Terms Of Service document from Prismic
 *
 * - **API ID**: `terms_of_service`
 * - **Repeatable**: `false`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type TermsOfServiceDocument<Lang extends string = string> = prismic.PrismicDocumentWithoutUID<Simplify<TermsOfServiceDocumentData>, "terms_of_service", Lang>;

export type AllDocumentTypes = CtaDocument | DisciplineDocument | DivisionDocument | FighterDocument | FooterDocument | HomePageDocument | MediaDocument | MediaTypeDocument | PageDocument | PictureDocument | PrivacyPolicyDocument | TermsOfServiceDocument;

/**
 * Primary content in *AboutUsCta → Default → Primary*
 */
export interface AboutUsCtaSliceDefaultPrimary {
	/**
	 * title field in *AboutUsCta → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: about_us_cta.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * title highlight field in *AboutUsCta → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: about_us_cta.default.primary.title_highlight
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title_highlight: prismic.KeyTextField;
	
	/**
	 * subtitle field in *AboutUsCta → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: about_us_cta.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
	
	/**
	 * cta field in *AboutUsCta → Default → Primary*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: about_us_cta.default.primary.cta
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	cta: prismic.Repeatable<prismic.LinkField<string, string, unknown, prismic.FieldState, "Primary" | "Secondary">>;
}

/**
 * Default variation for AboutUsCta Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type AboutUsCtaSliceDefault = prismic.SharedSliceVariation<"default", Simplify<AboutUsCtaSliceDefaultPrimary>, never>;

/**
 * Slice variation for *AboutUsCta*
 */
type AboutUsCtaSliceVariation = AboutUsCtaSliceDefault

/**
 * AboutUsCta Shared Slice
 *
 * - **API ID**: `about_us_cta`
 * - **Description**: AboutUsCta
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type AboutUsCtaSlice = prismic.SharedSlice<"about_us_cta", AboutUsCtaSliceVariation>;

/**
 * Primary content in *AboutUsHero → Default → Primary*
 */
export interface AboutUsHeroSliceDefaultPrimary {
	/**
	 * title field in *AboutUsHero → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: about_us_hero.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * title highlight field in *AboutUsHero → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: about_us_hero.default.primary.title_highlight
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title_highlight: prismic.KeyTextField;
	
	/**
	 * subtitle field in *AboutUsHero → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: about_us_hero.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
	
	/**
	 * image field in *AboutUsHero → Default → Primary*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: about_us_hero.default.primary.image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
}

/**
 * Default variation for AboutUsHero Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type AboutUsHeroSliceDefault = prismic.SharedSliceVariation<"default", Simplify<AboutUsHeroSliceDefaultPrimary>, never>;

/**
 * Slice variation for *AboutUsHero*
 */
type AboutUsHeroSliceVariation = AboutUsHeroSliceDefault

/**
 * AboutUsHero Shared Slice
 *
 * - **API ID**: `about_us_hero`
 * - **Description**: AboutUsHero
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type AboutUsHeroSlice = prismic.SharedSlice<"about_us_hero", AboutUsHeroSliceVariation>;

/**
 * Primary content in *CultureCommunity → Default → Primary*
 */
export interface CultureCommunitySliceDefaultPrimary {
	/**
	 * image 1 field in *CultureCommunity → Default → Primary*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: culture_community.default.primary.image_1
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image_1: prismic.ImageField<never>;
	
	/**
	 * image 2 field in *CultureCommunity → Default → Primary*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: culture_community.default.primary.image_2
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image_2: prismic.ImageField<never>;
	
	/**
	 * title field in *CultureCommunity → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: culture_community.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * text field in *CultureCommunity → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: culture_community.default.primary.text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	text: prismic.KeyTextField;
}

/**
 * Default variation for CultureCommunity Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type CultureCommunitySliceDefault = prismic.SharedSliceVariation<"default", Simplify<CultureCommunitySliceDefaultPrimary>, never>;

/**
 * Slice variation for *CultureCommunity*
 */
type CultureCommunitySliceVariation = CultureCommunitySliceDefault

/**
 * CultureCommunity Shared Slice
 *
 * - **API ID**: `culture_community`
 * - **Description**: CultureCommunity
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type CultureCommunitySlice = prismic.SharedSlice<"culture_community", CultureCommunitySliceVariation>;

/**
 * Item in *EventArchiveTable → Default → Primary → table headers*
 */
export interface EventArchiveTableSliceDefaultPrimaryTableHeadersItem {
	/**
	 * text field in *EventArchiveTable → Default → Primary → table headers*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.table_headers[].text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	text: prismic.KeyTextField;
}

/**
 * Item in *EventArchiveTable → Default → Primary → events*
 */
export interface EventArchiveTableSliceDefaultPrimaryEventsItem {
	/**
	 * name field in *EventArchiveTable → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.events[].name
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	name: prismic.KeyTextField;
	
	/**
	 * date field in *EventArchiveTable → Default → Primary → events*
	 *
	 * - **Field Type**: Date
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.events[].date
	 * - **Documentation**: https://prismic.io/docs/fields/date
	 */
	date: prismic.DateField;
	
	/**
	 * result field in *EventArchiveTable → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.events[].result
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	result: prismic.KeyTextField;
	
	/**
	 * replay youtube link field in *EventArchiveTable → Default → Primary → events*
	 *
	 * - **Field Type**: Embed
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.events[].replay_youtube_link
	 * - **Documentation**: https://prismic.io/docs/fields/embed
	 */
	replay_youtube_link: prismic.EmbedField
}

/**
 * Primary content in *EventArchiveTable → Default → Primary*
 */
export interface EventArchiveTableSliceDefaultPrimary {
	/**
	 * title field in *EventArchiveTable → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * table headers field in *EventArchiveTable → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.table_headers[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	table_headers: prismic.GroupField<Simplify<EventArchiveTableSliceDefaultPrimaryTableHeadersItem>>;
	
	/**
	 * events field in *EventArchiveTable → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.events[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	events: prismic.GroupField<Simplify<EventArchiveTableSliceDefaultPrimaryEventsItem>>;
	
	/**
	 * load more button label field in *EventArchiveTable → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.load_more_button_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	load_more_button_label: prismic.KeyTextField;
	
	/**
	 * load more button link field in *EventArchiveTable → Default → Primary*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.load_more_button_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	load_more_button_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Default variation for EventArchiveTable Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type EventArchiveTableSliceDefault = prismic.SharedSliceVariation<"default", Simplify<EventArchiveTableSliceDefaultPrimary>, never>;

/**
 * Slice variation for *EventArchiveTable*
 */
type EventArchiveTableSliceVariation = EventArchiveTableSliceDefault

/**
 * EventArchiveTable Shared Slice
 *
 * - **API ID**: `event_archive_table`
 * - **Description**: EventArchiveTable
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type EventArchiveTableSlice = prismic.SharedSlice<"event_archive_table", EventArchiveTableSliceVariation>;

/**
 * Item in *FeaturedEventHero → Default → Primary → cta*
 */
export interface FeaturedEventHeroSliceDefaultPrimaryCtaItem {
	/**
	 * label field in *FeaturedEventHero → Default → Primary → cta*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.cta[].label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	label: prismic.KeyTextField;
	
	/**
	 * link field in *FeaturedEventHero → Default → Primary → cta*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.cta[].link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, "Primary" | "Secondary">;
}

/**
 * Primary content in *FeaturedEventHero → Default → Primary*
 */
export interface FeaturedEventHeroSliceDefaultPrimary {
	/**
	 * badge field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.badge
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	badge: prismic.KeyTextField;
	
	/**
	 * title field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * subtitle field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
	
	/**
	 * date field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Timestamp
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.date
	 * - **Documentation**: https://prismic.io/docs/fields/timestamp
	 */
	date: prismic.TimestampField;
	
	/**
	 * image field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
	
	/**
	 * cta field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.cta[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	cta: prismic.GroupField<Simplify<FeaturedEventHeroSliceDefaultPrimaryCtaItem>>;
	
	/**
	 * location field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.location
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	location: prismic.KeyTextField;
	
	/**
	 * tba field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Boolean
	 * - **Placeholder**: *None*
	 * - **Default Value**: false
	 * - **API ID Path**: featured_event_hero.default.primary.tba
	 * - **Documentation**: https://prismic.io/docs/fields/boolean
	 */
	tba: prismic.BooleanField;
}

/**
 * Default variation for FeaturedEventHero Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FeaturedEventHeroSliceDefault = prismic.SharedSliceVariation<"default", Simplify<FeaturedEventHeroSliceDefaultPrimary>, never>;

/**
 * Slice variation for *FeaturedEventHero*
 */
type FeaturedEventHeroSliceVariation = FeaturedEventHeroSliceDefault

/**
 * FeaturedEventHero Shared Slice
 *
 * - **API ID**: `featured_event_hero`
 * - **Description**: FeaturedEventHero
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FeaturedEventHeroSlice = prismic.SharedSlice<"featured_event_hero", FeaturedEventHeroSliceVariation>;

/**
 * Item in *FeaturedFighters → Default → Primary → Fighters*
 */
export interface FeaturedFightersSliceDefaultPrimaryFightersItem {
	/**
	 * name field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].name
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	name: prismic.KeyTextField;
	
	/**
	 * nickname field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].nickname
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	nickname: prismic.KeyTextField;
	
	/**
	 * record field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].record
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	record: prismic.KeyTextField;
	
	/**
	 * nationality field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].nationality
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	nationality: prismic.KeyTextField;
	
	/**
	 * height field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].height
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	height: prismic.KeyTextField;
	
	/**
	 * age field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].age
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	age: prismic.KeyTextField;
	
	/**
	 * fighter image field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].fighter_image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	fighter_image: prismic.ImageField<never>;
}

/**
 * Primary content in *FeaturedFighters → Default → Primary*
 */
export interface FeaturedFightersSliceDefaultPrimary {
	/**
	 * Title field in *FeaturedFighters → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * Subtitle field in *FeaturedFighters → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
	
	/**
	 * Fighters field in *FeaturedFighters → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	fighters: prismic.GroupField<Simplify<FeaturedFightersSliceDefaultPrimaryFightersItem>>;
}

/**
 * Default variation for FeaturedFighters Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FeaturedFightersSliceDefault = prismic.SharedSliceVariation<"default", Simplify<FeaturedFightersSliceDefaultPrimary>, never>;

/**
 * Slice variation for *FeaturedFighters*
 */
type FeaturedFightersSliceVariation = FeaturedFightersSliceDefault

/**
 * FeaturedFighters Shared Slice
 *
 * - **API ID**: `featured_fighters`
 * - **Description**: FeaturedFighters
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FeaturedFightersSlice = prismic.SharedSlice<"featured_fighters", FeaturedFightersSliceVariation>;

/**
 * Primary content in *FeaturedVideo → Default → Primary*
 */
export interface FeaturedVideoSliceDefaultPrimary {
	/**
	 * headline 1 field in *FeaturedVideo → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_video.default.primary.headline_1
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	headline_1: prismic.KeyTextField;
	
	/**
	 * headline 2 field in *FeaturedVideo → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_video.default.primary.headline_2
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	headline_2: prismic.KeyTextField;
	
	/**
	 * subtitle field in *FeaturedVideo → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_video.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
	
	/**
	 * youtube link field in *FeaturedVideo → Default → Primary*
	 *
	 * - **Field Type**: Embed
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_video.default.primary.youtube_link
	 * - **Documentation**: https://prismic.io/docs/fields/embed
	 */
	youtube_link: prismic.EmbedField
	
	/**
	 * thumbnail field in *FeaturedVideo → Default → Primary*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_video.default.primary.thumbnail
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	thumbnail: prismic.ImageField<never>;
}

/**
 * Default variation for FeaturedVideo Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FeaturedVideoSliceDefault = prismic.SharedSliceVariation<"default", Simplify<FeaturedVideoSliceDefaultPrimary>, never>;

/**
 * Slice variation for *FeaturedVideo*
 */
type FeaturedVideoSliceVariation = FeaturedVideoSliceDefault

/**
 * FeaturedVideo Shared Slice
 *
 * - **API ID**: `featured_video`
 * - **Description**: FeaturedVideo
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FeaturedVideoSlice = prismic.SharedSlice<"featured_video", FeaturedVideoSliceVariation>;

/**
 * Item in *FightersSection → Default → Primary → fighters*
 */
export interface FightersSectionSliceDefaultPrimaryFightersItem {
	/**
	 * fighter field in *FightersSection → Default → Primary → fighters*
	 *
	 * - **Field Type**: Content Relationship
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighters_section.default.primary.fighters[].fighter
	 * - **Documentation**: https://prismic.io/docs/fields/content-relationship
	 */
	fighter: ContentRelationshipFieldWithData<[{"id":"fighter","fields":["name","nickname","record","image",{"id":"division","customtypes":[{"id":"division","fields":["name"]}]},{"id":"badges","fields":["label"]},{"id":"disciplines","fields":[{"id":"discipline","customtypes":[{"id":"discipline","fields":["name"]}]}]}]}]>;
}

/**
 * Primary content in *FightersSection → Default → Primary*
 */
export interface FightersSectionSliceDefaultPrimary {
	/**
	 * title field in *FightersSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighters_section.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * title highlight field in *FightersSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighters_section.default.primary.title_highlight
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title_highlight: prismic.KeyTextField;
	
	/**
	 * subtitle field in *FightersSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighters_section.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
	
	/**
	 * search placeholder field in *FightersSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighters_section.default.primary.search_placeholder
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	search_placeholder: prismic.KeyTextField;
	
	/**
	 * load more label field in *FightersSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighters_section.default.primary.load_more_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	load_more_label: prismic.KeyTextField;
	
	/**
	 * fighters field in *FightersSection → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: fighters_section.default.primary.fighters[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	fighters: prismic.GroupField<Simplify<FightersSectionSliceDefaultPrimaryFightersItem>>;
}

/**
 * Default variation for FightersSection Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FightersSectionSliceDefault = prismic.SharedSliceVariation<"default", Simplify<FightersSectionSliceDefaultPrimary>, never>;

/**
 * Slice variation for *FightersSection*
 */
type FightersSectionSliceVariation = FightersSectionSliceDefault

/**
 * FightersSection Shared Slice
 *
 * - **API ID**: `fighters_section`
 * - **Description**: FightersSection
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FightersSectionSlice = prismic.SharedSlice<"fighters_section", FightersSectionSliceVariation>;

/**
 * Item in *HeroSection → Default → Primary → cta*
 */
export interface HeroSectionSliceDefaultPrimaryCtaItem {
	/**
	 * label field in *HeroSection → Default → Primary → cta*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.cta[].label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	label: prismic.KeyTextField;
	
	/**
	 * link field in *HeroSection → Default → Primary → cta*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.cta[].link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, "Primary" | "Secondary">;
	
	/**
	 * icon field in *HeroSection → Default → Primary → cta*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.cta[].icon
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	icon: prismic.KeyTextField;
}

/**
 * Primary content in *HeroSection → Default → Primary*
 */
export interface HeroSectionSliceDefaultPrimary {
	/**
	 * Background Image field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.background_image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	background_image: prismic.ImageField<never>;
	
	/**
	 * Badge Text field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.badge_text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	badge_text: prismic.KeyTextField;
	
	/**
	 * Headline 1 field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.headline_1
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	headline_1: prismic.KeyTextField;
	
	/**
	 * Headline 2 field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.headline_2
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	headline_2: prismic.KeyTextField;
	
	/**
	 * Headline 3 field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.headline_3
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	headline_3: prismic.KeyTextField;
	
	/**
	 * description field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.description
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	description: prismic.RichTextField;
	
	/**
	 * Event time field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Timestamp
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.event_time
	 * - **Documentation**: https://prismic.io/docs/fields/timestamp
	 */
	event_time: prismic.TimestampField;
	
	/**
	 * Event Location field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.event_location
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	event_location: prismic.KeyTextField;
	
	/**
	 * cta field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.cta[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	cta: prismic.GroupField<Simplify<HeroSectionSliceDefaultPrimaryCtaItem>>;
	
	/**
	 * tba field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Boolean
	 * - **Placeholder**: *None*
	 * - **Default Value**: false
	 * - **API ID Path**: hero_section.default.primary.tba
	 * - **Documentation**: https://prismic.io/docs/fields/boolean
	 */
	tba: prismic.BooleanField;
}

/**
 * Default variation for HeroSection Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type HeroSectionSliceDefault = prismic.SharedSliceVariation<"default", Simplify<HeroSectionSliceDefaultPrimary>, never>;

/**
 * Slice variation for *HeroSection*
 */
type HeroSectionSliceVariation = HeroSectionSliceDefault

/**
 * HeroSection Shared Slice
 *
 * - **API ID**: `hero_section`
 * - **Description**: HeroSection
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type HeroSectionSlice = prismic.SharedSlice<"hero_section", HeroSectionSliceVariation>;

/**
 * Item in *ImageGallery → Default → Primary → images*
 */
export interface ImageGallerySliceDefaultPrimaryImagesItem {
	/**
	 * image field in *ImageGallery → Default → Primary → images*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: image_gallery.default.primary.images[].image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
}

/**
 * Primary content in *ImageGallery → Default → Primary*
 */
export interface ImageGallerySliceDefaultPrimary {
	/**
	 * title field in *ImageGallery → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: image_gallery.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * title highlight field in *ImageGallery → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: image_gallery.default.primary.title_highlight
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title_highlight: prismic.KeyTextField;
	
	/**
	 * images field in *ImageGallery → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: image_gallery.default.primary.images[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	images: prismic.GroupField<Simplify<ImageGallerySliceDefaultPrimaryImagesItem>>;
	
	/**
	 * view all button label field in *ImageGallery → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: image_gallery.default.primary.view_all_button_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	view_all_button_label: prismic.KeyTextField;
}

/**
 * Default variation for ImageGallery Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type ImageGallerySliceDefault = prismic.SharedSliceVariation<"default", Simplify<ImageGallerySliceDefaultPrimary>, never>;

/**
 * Slice variation for *ImageGallery*
 */
type ImageGallerySliceVariation = ImageGallerySliceDefault

/**
 * ImageGallery Shared Slice
 *
 * - **API ID**: `image_gallery`
 * - **Description**: ImageGallery
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type ImageGallerySlice = prismic.SharedSlice<"image_gallery", ImageGallerySliceVariation>;

/**
 * Item in *LatestNews → Default → Primary → articles*
 */
export interface LatestNewsSliceDefaultPrimaryArticlesItem {
	/**
	 * title field in *LatestNews → Default → Primary → articles*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.articles[].title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * date field in *LatestNews → Default → Primary → articles*
	 *
	 * - **Field Type**: Date
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.articles[].date
	 * - **Documentation**: https://prismic.io/docs/fields/date
	 */
	date: prismic.DateField;
	
	/**
	 * excerpt field in *LatestNews → Default → Primary → articles*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.articles[].excerpt
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	excerpt: prismic.KeyTextField;
	
	/**
	 * image field in *LatestNews → Default → Primary → articles*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.articles[].image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
	
	/**
	 * article link field in *LatestNews → Default → Primary → articles*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.articles[].article_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	article_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Primary content in *LatestNews → Default → Primary*
 */
export interface LatestNewsSliceDefaultPrimary {
	/**
	 * title field in *LatestNews → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * show all link field in *LatestNews → Default → Primary*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.show_all_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	show_all_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
	
	/**
	 * articles field in *LatestNews → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.articles[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	articles: prismic.GroupField<Simplify<LatestNewsSliceDefaultPrimaryArticlesItem>>;
}

/**
 * Default variation for LatestNews Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type LatestNewsSliceDefault = prismic.SharedSliceVariation<"default", Simplify<LatestNewsSliceDefaultPrimary>, never>;

/**
 * Slice variation for *LatestNews*
 */
type LatestNewsSliceVariation = LatestNewsSliceDefault

/**
 * LatestNews Shared Slice
 *
 * - **API ID**: `latest_news`
 * - **Description**: LatestNews
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type LatestNewsSlice = prismic.SharedSlice<"latest_news", LatestNewsSliceVariation>;

/**
 * Item in *MediaArchive → Default → Primary → content*
 */
export interface MediaArchiveSliceDefaultPrimaryContentItem {
	/**
	 * media field in *MediaArchive → Default → Primary → content*
	 *
	 * - **Field Type**: Content Relationship
	 * - **Placeholder**: *None*
	 * - **API ID Path**: media_archive.default.primary.content[].media
	 * - **Documentation**: https://prismic.io/docs/fields/content-relationship
	 */
	media: prismic.ContentRelationshipField<"media">;
}

/**
 * Primary content in *MediaArchive → Default → Primary*
 */
export interface MediaArchiveSliceDefaultPrimary {
	/**
	 * title field in *MediaArchive → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: media_archive.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * title highlight field in *MediaArchive → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: media_archive.default.primary.title_highlight
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title_highlight: prismic.KeyTextField;
	
	/**
	 * description field in *MediaArchive → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: media_archive.default.primary.description
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	description: prismic.KeyTextField;
	
	/**
	 * content field in *MediaArchive → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: media_archive.default.primary.content[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	content: prismic.GroupField<Simplify<MediaArchiveSliceDefaultPrimaryContentItem>>;
}

/**
 * Default variation for MediaArchive Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type MediaArchiveSliceDefault = prismic.SharedSliceVariation<"default", Simplify<MediaArchiveSliceDefaultPrimary>, never>;

/**
 * Slice variation for *MediaArchive*
 */
type MediaArchiveSliceVariation = MediaArchiveSliceDefault

/**
 * MediaArchive Shared Slice
 *
 * - **API ID**: `media_archive`
 * - **Description**: MediaArchive
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type MediaArchiveSlice = prismic.SharedSlice<"media_archive", MediaArchiveSliceVariation>;

/**
 * Item in *MissionValuesGrid → Default → Primary → items*
 */
export interface MissionValuesGridSliceDefaultPrimaryItemsItem {
	/**
	 * title field in *MissionValuesGrid → Default → Primary → items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: mission_values_grid.default.primary.items[].title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * text field in *MissionValuesGrid → Default → Primary → items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: mission_values_grid.default.primary.items[].text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	text: prismic.KeyTextField;
	
	/**
	 * icon field in *MissionValuesGrid → Default → Primary → items*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: mission_values_grid.default.primary.items[].icon
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	icon: prismic.KeyTextField;
}

/**
 * Primary content in *MissionValuesGrid → Default → Primary*
 */
export interface MissionValuesGridSliceDefaultPrimary {
	/**
	 * items field in *MissionValuesGrid → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: mission_values_grid.default.primary.items[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	items: prismic.GroupField<Simplify<MissionValuesGridSliceDefaultPrimaryItemsItem>>;
}

/**
 * Default variation for MissionValuesGrid Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type MissionValuesGridSliceDefault = prismic.SharedSliceVariation<"default", Simplify<MissionValuesGridSliceDefaultPrimary>, never>;

/**
 * Slice variation for *MissionValuesGrid*
 */
type MissionValuesGridSliceVariation = MissionValuesGridSliceDefault

/**
 * MissionValuesGrid Shared Slice
 *
 * - **API ID**: `mission_values_grid`
 * - **Description**: MissionValuesGrid
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type MissionValuesGridSlice = prismic.SharedSlice<"mission_values_grid", MissionValuesGridSliceVariation>;

/**
 * Primary content in *Newsletter → Default → Primary*
 */
export interface NewsletterSliceDefaultPrimary {
	/**
	 * headline 1 field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.headline_1
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	headline_1: prismic.KeyTextField;
	
	/**
	 * headline 2 field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.headline_2
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	headline_2: prismic.KeyTextField;
	
	/**
	 * description field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.description
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	description: prismic.KeyTextField;
	
	/**
	 * email placeholder field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.email_placeholder
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	email_placeholder: prismic.KeyTextField;
	
	/**
	 * submit label field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.submit_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	submit_label: prismic.KeyTextField;
	
	/**
	 * success message field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.success_message
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	success_message: prismic.KeyTextField;
	
	/**
	 * error message field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.error_message
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	error_message: prismic.KeyTextField;
}

/**
 * Default variation for Newsletter Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type NewsletterSliceDefault = prismic.SharedSliceVariation<"default", Simplify<NewsletterSliceDefaultPrimary>, never>;

/**
 * Slice variation for *Newsletter*
 */
type NewsletterSliceVariation = NewsletterSliceDefault

/**
 * Newsletter Shared Slice
 *
 * - **API ID**: `newsletter`
 * - **Description**: Newsletter
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type NewsletterSlice = prismic.SharedSlice<"newsletter", NewsletterSliceVariation>;

/**
 * Item in *OurStory → Default → Primary → stats*
 */
export interface OurStorySliceDefaultPrimaryStatsItem {
	/**
	 * value field in *OurStory → Default → Primary → stats*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: our_story.default.primary.stats[].value
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	value: prismic.KeyTextField;
	
	/**
	 * label field in *OurStory → Default → Primary → stats*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: our_story.default.primary.stats[].label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	label: prismic.KeyTextField;
}

/**
 * Primary content in *OurStory → Default → Primary*
 */
export interface OurStorySliceDefaultPrimary {
	/**
	 * title field in *OurStory → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: our_story.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * body field in *OurStory → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: our_story.default.primary.body
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	body: prismic.RichTextField;
	
	/**
	 * image field in *OurStory → Default → Primary*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: our_story.default.primary.image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
	
	/**
	 * stats field in *OurStory → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: our_story.default.primary.stats[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	stats: prismic.GroupField<Simplify<OurStorySliceDefaultPrimaryStatsItem>>;
}

/**
 * Default variation for OurStory Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type OurStorySliceDefault = prismic.SharedSliceVariation<"default", Simplify<OurStorySliceDefaultPrimary>, never>;

/**
 * Slice variation for *OurStory*
 */
type OurStorySliceVariation = OurStorySliceDefault

/**
 * OurStory Shared Slice
 *
 * - **API ID**: `our_story`
 * - **Description**: OurStory
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type OurStorySlice = prismic.SharedSlice<"our_story", OurStorySliceVariation>;

/**
 * Primary content in *PrivacyPolicy → Default → Primary*
 */
export interface PrivacyPolicySliceDefaultPrimary {
	/**
	 * content field in *PrivacyPolicy → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: privacy_policy.default.primary.content
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	content: prismic.RichTextField;
}

/**
 * Default variation for PrivacyPolicy Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type PrivacyPolicySliceDefault = prismic.SharedSliceVariation<"default", Simplify<PrivacyPolicySliceDefaultPrimary>, never>;

/**
 * Slice variation for *PrivacyPolicy*
 */
type PrivacyPolicySliceVariation = PrivacyPolicySliceDefault

/**
 * PrivacyPolicy Shared Slice
 *
 * - **API ID**: `privacy_policy`
 * - **Description**: PrivacyPolicy
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type PrivacyPolicySlice = prismic.SharedSlice<"privacy_policy", PrivacyPolicySliceVariation>;

/**
 * Item in *SponsorLogos → Default → Primary → sponsors*
 */
export interface SponsorLogosSliceDefaultPrimarySponsorsItem {
	/**
	 * logo field in *SponsorLogos → Default → Primary → sponsors*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: sponsor_logos.default.primary.sponsors[].logo
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	logo: prismic.ImageField<never>;
	
	/**
	 * link field in *SponsorLogos → Default → Primary → sponsors*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: sponsor_logos.default.primary.sponsors[].link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Primary content in *SponsorLogos → Default → Primary*
 */
export interface SponsorLogosSliceDefaultPrimary {
	/**
	 * title field in *SponsorLogos → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: sponsor_logos.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * sponsors field in *SponsorLogos → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: sponsor_logos.default.primary.sponsors[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	sponsors: prismic.GroupField<Simplify<SponsorLogosSliceDefaultPrimarySponsorsItem>>;
}

/**
 * Default variation for SponsorLogos Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type SponsorLogosSliceDefault = prismic.SharedSliceVariation<"default", Simplify<SponsorLogosSliceDefaultPrimary>, never>;

/**
 * Slice variation for *SponsorLogos*
 */
type SponsorLogosSliceVariation = SponsorLogosSliceDefault

/**
 * SponsorLogos Shared Slice
 *
 * - **API ID**: `sponsor_logos`
 * - **Description**: SponsorLogos
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type SponsorLogosSlice = prismic.SharedSlice<"sponsor_logos", SponsorLogosSliceVariation>;

/**
 * Primary content in *TermsOfService → Default → Primary*
 */
export interface TermsOfServiceSliceDefaultPrimary {
	/**
	 * content field in *TermsOfService → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: terms_of_service.default.primary.content
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	content: prismic.RichTextField;
}

/**
 * Default variation for TermsOfService Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type TermsOfServiceSliceDefault = prismic.SharedSliceVariation<"default", Simplify<TermsOfServiceSliceDefaultPrimary>, never>;

/**
 * Slice variation for *TermsOfService*
 */
type TermsOfServiceSliceVariation = TermsOfServiceSliceDefault

/**
 * TermsOfService Shared Slice
 *
 * - **API ID**: `terms_of_service`
 * - **Description**: TermsOfService
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type TermsOfServiceSlice = prismic.SharedSlice<"terms_of_service", TermsOfServiceSliceVariation>;

/**
 * Item in *TheArchitects → Default → Primary → main*
 */
export interface TheArchitectsSliceDefaultPrimaryMainItem {
	/**
	 * name field in *TheArchitects → Default → Primary → main*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: the_architects.default.primary.main[].name
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	name: prismic.KeyTextField;
	
	/**
	 * position field in *TheArchitects → Default → Primary → main*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: the_architects.default.primary.main[].position
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	position: prismic.KeyTextField;
	
	/**
	 * image field in *TheArchitects → Default → Primary → main*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: the_architects.default.primary.main[].image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
}

/**
 * Item in *TheArchitects → Default → Primary → more*
 */
export interface TheArchitectsSliceDefaultPrimaryMoreItem {
	/**
	 * name field in *TheArchitects → Default → Primary → more*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: the_architects.default.primary.more[].name
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	name: prismic.KeyTextField;
	
	/**
	 * position field in *TheArchitects → Default → Primary → more*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: the_architects.default.primary.more[].position
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	position: prismic.KeyTextField;
}

/**
 * Primary content in *TheArchitects → Default → Primary*
 */
export interface TheArchitectsSliceDefaultPrimary {
	/**
	 * title field in *TheArchitects → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: the_architects.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * main field in *TheArchitects → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: the_architects.default.primary.main[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	main: prismic.GroupField<Simplify<TheArchitectsSliceDefaultPrimaryMainItem>>;
	
	/**
	 * more field in *TheArchitects → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: the_architects.default.primary.more[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	more: prismic.GroupField<Simplify<TheArchitectsSliceDefaultPrimaryMoreItem>>;
}

/**
 * Default variation for TheArchitects Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type TheArchitectsSliceDefault = prismic.SharedSliceVariation<"default", Simplify<TheArchitectsSliceDefaultPrimary>, never>;

/**
 * Slice variation for *TheArchitects*
 */
type TheArchitectsSliceVariation = TheArchitectsSliceDefault

/**
 * TheArchitects Shared Slice
 *
 * - **API ID**: `the_architects`
 * - **Description**: TheArchitects
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type TheArchitectsSlice = prismic.SharedSlice<"the_architects", TheArchitectsSliceVariation>;

/**
 * Primary content in *UpcomingEvent → Default → Primary*
 */
export interface UpcomingEventSliceDefaultPrimary {
	/**
	 * title field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * Event Date field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Timestamp
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.event_date
	 * - **Documentation**: https://prismic.io/docs/fields/timestamp
	 */
	event_date: prismic.TimestampField;
	
	/**
	 * Event Venue field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.event_venue
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	event_venue: prismic.KeyTextField;
	
	/**
	 * Event Poster field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.event_poster
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	event_poster: prismic.ImageField<never>;
	
	/**
	 * Main Headline field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.main_headline
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	main_headline: prismic.KeyTextField;
	
	/**
	 * Subtitle field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
	
	/**
	 * Background Watermark field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.background_watermark
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	background_watermark: prismic.KeyTextField;
	
	/**
	 * tba field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Boolean
	 * - **Placeholder**: *None*
	 * - **Default Value**: false
	 * - **API ID Path**: upcoming_event.default.primary.tba
	 * - **Documentation**: https://prismic.io/docs/fields/boolean
	 */
	tba: prismic.BooleanField;
}

/**
 * Default variation for UpcomingEvent Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type UpcomingEventSliceDefault = prismic.SharedSliceVariation<"default", Simplify<UpcomingEventSliceDefaultPrimary>, never>;

/**
 * Slice variation for *UpcomingEvent*
 */
type UpcomingEventSliceVariation = UpcomingEventSliceDefault

/**
 * UpcomingEvent Shared Slice
 *
 * - **API ID**: `upcoming_event`
 * - **Description**: UpcomingEvent
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type UpcomingEventSlice = prismic.SharedSlice<"upcoming_event", UpcomingEventSliceVariation>;

/**
 * Item in *UpcomingEventsGrid → Default → Primary → events*
 */
export interface UpcomingEventsGridSliceDefaultPrimaryEventsItem {
	/**
	 * badge field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].badge
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	badge: prismic.KeyTextField;
	
	/**
	 * title field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * date field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Date
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].date
	 * - **Documentation**: https://prismic.io/docs/fields/date
	 */
	date: prismic.DateField;
	
	/**
	 * venue field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].venue
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	venue: prismic.KeyTextField;
	
	/**
	 * image field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
	
	/**
	 * tags comma separated field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].tags_comma_separated
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	tags_comma_separated: prismic.KeyTextField;
	
	/**
	 * tickets button text field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].tickets_button_text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	tickets_button_text: prismic.KeyTextField;
	
	/**
	 * tickets button link field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].tickets_button_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	tickets_button_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
	
	/**
	 * stream button text field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].stream_button_text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	stream_button_text: prismic.KeyTextField;
	
	/**
	 * stream button link field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].stream_button_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	stream_button_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Primary content in *UpcomingEventsGrid → Default → Primary*
 */
export interface UpcomingEventsGridSliceDefaultPrimary {
	/**
	 * title field in *UpcomingEventsGrid → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * subtitle field in *UpcomingEventsGrid → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
	
	/**
	 * decorative text field in *UpcomingEventsGrid → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.decorative_text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	decorative_text: prismic.KeyTextField;
	
	/**
	 * events field in *UpcomingEventsGrid → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	events: prismic.GroupField<Simplify<UpcomingEventsGridSliceDefaultPrimaryEventsItem>>;
	
	/**
	 * tba field in *UpcomingEventsGrid → Default → Primary*
	 *
	 * - **Field Type**: Boolean
	 * - **Placeholder**: *None*
	 * - **Default Value**: false
	 * - **API ID Path**: upcoming_events_grid.default.primary.tba
	 * - **Documentation**: https://prismic.io/docs/fields/boolean
	 */
	tba: prismic.BooleanField;
}

/**
 * Default variation for UpcomingEventsGrid Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type UpcomingEventsGridSliceDefault = prismic.SharedSliceVariation<"default", Simplify<UpcomingEventsGridSliceDefaultPrimary>, never>;

/**
 * Slice variation for *UpcomingEventsGrid*
 */
type UpcomingEventsGridSliceVariation = UpcomingEventsGridSliceDefault

/**
 * UpcomingEventsGrid Shared Slice
 *
 * - **API ID**: `upcoming_events_grid`
 * - **Description**: UpcomingEventsGrid
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type UpcomingEventsGridSlice = prismic.SharedSlice<"upcoming_events_grid", UpcomingEventsGridSliceVariation>;

/**
 * Item in *VenueInformation → Default → Primary → transport info*
 */
export interface VenueInformationSliceDefaultPrimaryTransportInfoItem {
	/**
	 * icon field in *VenueInformation → Default → Primary → transport info*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.transport_info[].icon
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	icon: prismic.KeyTextField;
	
	/**
	 * text field in *VenueInformation → Default → Primary → transport info*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.transport_info[].text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	text: prismic.KeyTextField;
}

/**
 * Primary content in *VenueInformation → Default → Primary*
 */
export interface VenueInformationSliceDefaultPrimary {
	/**
	 * title line 1 field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.title_line_1
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title_line_1: prismic.KeyTextField;
	
	/**
	 * title line 2 field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.title_line_2
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title_line_2: prismic.KeyTextField;
	
	/**
	 * venue label field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.venue_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	venue_label: prismic.KeyTextField;
	
	/**
	 * venue name field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.venue_name
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	venue_name: prismic.KeyTextField;
	
	/**
	 * transport info field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.transport_info[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	transport_info: prismic.GroupField<Simplify<VenueInformationSliceDefaultPrimaryTransportInfoItem>>;
	
	/**
	 * directions button label field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.directions_button_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	directions_button_label: prismic.KeyTextField;
	
	/**
	 * directions buttons link field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.directions_buttons_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	directions_buttons_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
	
	/**
	 * address field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.address
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	address: prismic.KeyTextField;
	
	/**
	 * google maps embed field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.google_maps_embed
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	google_maps_embed: prismic.KeyTextField;
}

/**
 * Default variation for VenueInformation Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type VenueInformationSliceDefault = prismic.SharedSliceVariation<"default", Simplify<VenueInformationSliceDefaultPrimary>, never>;

/**
 * Slice variation for *VenueInformation*
 */
type VenueInformationSliceVariation = VenueInformationSliceDefault

/**
 * VenueInformation Shared Slice
 *
 * - **API ID**: `venue_information`
 * - **Description**: VenueInformation
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type VenueInformationSlice = prismic.SharedSlice<"venue_information", VenueInformationSliceVariation>;

/**
 * Item in *VideoHighlights → Default → Primary → highlights*
 */
export interface VideoHighlightsSliceDefaultPrimaryVideosItem {
	/**
	 * title field in *VideoHighlights → Default → Primary → highlights*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: video_highlights.default.primary.videos[].title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * thumbnail field in *VideoHighlights → Default → Primary → highlights*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: video_highlights.default.primary.videos[].thumbnail
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	thumbnail: prismic.ImageField<never>;
	
	/**
	 * youtube url field in *VideoHighlights → Default → Primary → highlights*
	 *
	 * - **Field Type**: Embed
	 * - **Placeholder**: *None*
	 * - **API ID Path**: video_highlights.default.primary.videos[].youtube_url
	 * - **Documentation**: https://prismic.io/docs/fields/embed
	 */
	youtube_url: prismic.EmbedField
}

/**
 * Primary content in *VideoHighlights → Default → Primary*
 */
export interface VideoHighlightsSliceDefaultPrimary {
	/**
	 * title field in *VideoHighlights → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: video_highlights.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * description field in *VideoHighlights → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: video_highlights.default.primary.description
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	description: prismic.KeyTextField;
	
	/**
	 * highlights field in *VideoHighlights → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: video_highlights.default.primary.videos[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	videos: prismic.GroupField<Simplify<VideoHighlightsSliceDefaultPrimaryVideosItem>>;
}

/**
 * Default variation for VideoHighlights Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type VideoHighlightsSliceDefault = prismic.SharedSliceVariation<"default", Simplify<VideoHighlightsSliceDefaultPrimary>, never>;

/**
 * Slice variation for *VideoHighlights*
 */
type VideoHighlightsSliceVariation = VideoHighlightsSliceDefault

/**
 * VideoHighlights Shared Slice
 *
 * - **API ID**: `video_highlights`
 * - **Description**: VideoHighlights
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type VideoHighlightsSlice = prismic.SharedSlice<"video_highlights", VideoHighlightsSliceVariation>;

declare module "@prismicio/client" {
	interface CreateClient {
		(repositoryNameOrEndpoint: string, options?: prismic.ClientConfig): prismic.Client<AllDocumentTypes>;
	}
	
	interface CreateWriteClient {
		(repositoryNameOrEndpoint: string, options: prismic.WriteClientConfig): prismic.WriteClient<AllDocumentTypes>;
	}
	
	interface CreateMigration {
		(): prismic.Migration<AllDocumentTypes>;
	}
	
	namespace Content {
		export type {
			CtaDocument,
			CtaDocumentData,
			DisciplineDocument,
			DisciplineDocumentData,
			DivisionDocument,
			DivisionDocumentData,
			FighterDocument,
			FighterDocumentData,
			FighterDocumentDataDisciplinesItem,
			FighterDocumentDataBadgesItem,
			FighterDocumentDataRecentBattlesItem,
			FighterDocumentDataCombatArchiveItem,
			FooterDocument,
			FooterDocumentData,
			FooterDocumentDataSocialLinksItem,
			FooterDocumentDataNavigationLinksItem,
			FooterDocumentDataLegalLinksItem,
			FooterDocumentDataContactLinksItem,
			HomePageDocument,
			HomePageDocumentData,
			HomePageDocumentDataSlicesSlice,
			MediaDocument,
			MediaDocumentData,
			MediaDocumentDataBadgesItem,
			MediaTypeDocument,
			MediaTypeDocumentData,
			PageDocument,
			PageDocumentData,
			PageDocumentDataSlicesSlice,
			PictureDocument,
			PictureDocumentData,
			PrivacyPolicyDocument,
			PrivacyPolicyDocumentData,
			PrivacyPolicyDocumentDataSlicesSlice,
			TermsOfServiceDocument,
			TermsOfServiceDocumentData,
			TermsOfServiceDocumentDataSlicesSlice,
			AllDocumentTypes,
			AboutUsCtaSlice,
			AboutUsCtaSliceDefaultPrimary,
			AboutUsCtaSliceVariation,
			AboutUsCtaSliceDefault,
			AboutUsHeroSlice,
			AboutUsHeroSliceDefaultPrimary,
			AboutUsHeroSliceVariation,
			AboutUsHeroSliceDefault,
			CultureCommunitySlice,
			CultureCommunitySliceDefaultPrimary,
			CultureCommunitySliceVariation,
			CultureCommunitySliceDefault,
			EventArchiveTableSlice,
			EventArchiveTableSliceDefaultPrimaryTableHeadersItem,
			EventArchiveTableSliceDefaultPrimaryEventsItem,
			EventArchiveTableSliceDefaultPrimary,
			EventArchiveTableSliceVariation,
			EventArchiveTableSliceDefault,
			FeaturedEventHeroSlice,
			FeaturedEventHeroSliceDefaultPrimaryCtaItem,
			FeaturedEventHeroSliceDefaultPrimary,
			FeaturedEventHeroSliceVariation,
			FeaturedEventHeroSliceDefault,
			FeaturedFightersSlice,
			FeaturedFightersSliceDefaultPrimaryFightersItem,
			FeaturedFightersSliceDefaultPrimary,
			FeaturedFightersSliceVariation,
			FeaturedFightersSliceDefault,
			FeaturedVideoSlice,
			FeaturedVideoSliceDefaultPrimary,
			FeaturedVideoSliceVariation,
			FeaturedVideoSliceDefault,
			FightersSectionSlice,
			FightersSectionSliceDefaultPrimaryFightersItem,
			FightersSectionSliceDefaultPrimary,
			FightersSectionSliceVariation,
			FightersSectionSliceDefault,
			HeroSectionSlice,
			HeroSectionSliceDefaultPrimaryCtaItem,
			HeroSectionSliceDefaultPrimary,
			HeroSectionSliceVariation,
			HeroSectionSliceDefault,
			ImageGallerySlice,
			ImageGallerySliceDefaultPrimaryImagesItem,
			ImageGallerySliceDefaultPrimary,
			ImageGallerySliceVariation,
			ImageGallerySliceDefault,
			LatestNewsSlice,
			LatestNewsSliceDefaultPrimaryArticlesItem,
			LatestNewsSliceDefaultPrimary,
			LatestNewsSliceVariation,
			LatestNewsSliceDefault,
			MediaArchiveSlice,
			MediaArchiveSliceDefaultPrimaryContentItem,
			MediaArchiveSliceDefaultPrimary,
			MediaArchiveSliceVariation,
			MediaArchiveSliceDefault,
			MissionValuesGridSlice,
			MissionValuesGridSliceDefaultPrimaryItemsItem,
			MissionValuesGridSliceDefaultPrimary,
			MissionValuesGridSliceVariation,
			MissionValuesGridSliceDefault,
			NewsletterSlice,
			NewsletterSliceDefaultPrimary,
			NewsletterSliceVariation,
			NewsletterSliceDefault,
			OurStorySlice,
			OurStorySliceDefaultPrimaryStatsItem,
			OurStorySliceDefaultPrimary,
			OurStorySliceVariation,
			OurStorySliceDefault,
			PrivacyPolicySlice,
			PrivacyPolicySliceDefaultPrimary,
			PrivacyPolicySliceVariation,
			PrivacyPolicySliceDefault,
			SponsorLogosSlice,
			SponsorLogosSliceDefaultPrimarySponsorsItem,
			SponsorLogosSliceDefaultPrimary,
			SponsorLogosSliceVariation,
			SponsorLogosSliceDefault,
			TermsOfServiceSlice,
			TermsOfServiceSliceDefaultPrimary,
			TermsOfServiceSliceVariation,
			TermsOfServiceSliceDefault,
			TheArchitectsSlice,
			TheArchitectsSliceDefaultPrimaryMainItem,
			TheArchitectsSliceDefaultPrimaryMoreItem,
			TheArchitectsSliceDefaultPrimary,
			TheArchitectsSliceVariation,
			TheArchitectsSliceDefault,
			UpcomingEventSlice,
			UpcomingEventSliceDefaultPrimary,
			UpcomingEventSliceVariation,
			UpcomingEventSliceDefault,
			UpcomingEventsGridSlice,
			UpcomingEventsGridSliceDefaultPrimaryEventsItem,
			UpcomingEventsGridSliceDefaultPrimary,
			UpcomingEventsGridSliceVariation,
			UpcomingEventsGridSliceDefault,
			VenueInformationSlice,
			VenueInformationSliceDefaultPrimaryTransportInfoItem,
			VenueInformationSliceDefaultPrimary,
			VenueInformationSliceVariation,
			VenueInformationSliceDefault,
			VideoHighlightsSlice,
			VideoHighlightsSliceDefaultPrimaryVideosItem,
			VideoHighlightsSliceDefaultPrimary,
			VideoHighlightsSliceVariation,
			VideoHighlightsSliceDefault
		}
	}
}